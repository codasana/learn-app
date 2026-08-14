/**
 * Proves the R2 credentials actually work, end to end, then cleans up.
 *
 *   npx tsx scripts/test-r2.ts
 *
 * Worth running before any UI depends on storage: a wrong account id or a
 * token scoped to the wrong bucket fails in ways that are easy to mistake for
 * a bug in the upload form.
 *
 * It checks all four things that can be independently wrong:
 *   1. the S3 credentials can write
 *   2. the presigned upload URL works from outside the SDK
 *   3. the public base URL actually serves the file
 *   4. delete works, so nothing is left behind
 */
import { createRequire } from "node:module";

import { config } from "dotenv";

config({ path: ".env.local" });

/*
 * `server-only` is a package that throws on purpose when it is imported
 * outside Next's bundler — which is exactly what this script is. Stubbing the
 * module loader lets a plain node script import lib/r2 unchanged, rather than
 * keeping a second copy of the storage code that could drift.
 */
const nodeRequire = createRequire(import.meta.url);
const Module = nodeRequire("node:module") as {
  _load: (req: string, parent: unknown, isMain: boolean) => unknown;
};
const load = Module._load;
Module._load = (req, parent, isMain) =>
  req === "server-only" ? {} : load(req, parent, isMain);

async function main() {
  const r2 = await import("../src/lib/r2");

  let failures = 0;
  const check = (label: string, ok: boolean, detail?: string) => {
    if (!ok) failures++;
    console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  };

  if (!r2.storageReady()) {
    console.error("Some R2_* variables are missing from .env.local.");
    process.exit(1);
  }

  console.log(`bucket: ${r2.bucket()}`);
  console.log(`public: ${process.env.R2_PUBLIC_BASE_URL}\n`);

  // --- filename handling, before anything touches the network -------
  check(
    "strips a path-traversal filename",
    r2.safeName("../../etc/passwd") === "etcpasswd",
    r2.safeName("../../etc/passwd"),
  );
  check(
    "keeps a normal filename readable",
    r2.safeName("Week 1 worksheet.pdf") === "Week-1-worksheet.pdf",
    r2.safeName("Week 1 worksheet.pdf"),
  );
  check(
    "survives a filename that is entirely junk",
    r2.safeName("###") === "file",
    r2.safeName("###"),
  );

  const key = r2.storageKey("_selftest", "hello world.txt");
  const body = `written by scripts/test-r2.ts at ${new Date().toISOString()}`;

  // --- 1. write through the SDK -------------------------------------
  try {
    await r2.putObject(key, body, "text/plain");
    check("SDK can write to the bucket", true);
  } catch (err) {
    check("SDK can write to the bucket", false, String(err));
    console.error("\nStopping — nothing else can pass if this failed.");
    process.exit(1);
  }

  check("the object is there", await r2.objectExists(key));

  // --- 2. the public URL serves it ----------------------------------
  const url = r2.publicUrl(key);
  const res = await fetch(url, { cache: "no-store" });
  const text = res.ok ? await res.text() : "";
  check(
    "the public URL serves the file",
    res.ok && text === body,
    res.ok ? undefined : `HTTP ${res.status} — is public access switched on?`,
  );

  // --- 3. a presigned upload works from outside the SDK -------------
  const presignedKey = r2.storageKey("_selftest", "presigned.txt");
  const uploadUrl = await r2.presignedUpload(presignedKey, "text/plain");
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": "text/plain" },
    body: "uploaded straight from the browser",
  });
  check(
    "a presigned URL accepts a direct upload",
    put.ok,
    put.ok ? undefined : `HTTP ${put.status}`,
  );

  // --- 4. clean up ---------------------------------------------------
  await r2.deleteObject(key);
  await r2.deleteObject(presignedKey);
  check("delete removes the object", !(await r2.objectExists(key)));

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nall checks passed — storage is ready");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
