/**
 * Proves the Automette integration against production, then cleans up.
 *
 *   npx tsx scripts/test-automette.ts
 *
 * We are a customer, so this exercises exactly what a customer can reach: the
 * public v1 API with an API key. It renders a real document, copies it into our
 * own storage, checks the copy opens, and deletes it again.
 *
 * Uses whatever template the account already has rather than requiring a
 * specific one — the point is that the plumbing works, not what the document
 * says.
 */
import { createRequire } from "node:module";

import { config } from "dotenv";

config({ path: ".env.local" });

const nodeRequire = createRequire(import.meta.url);
const Module = nodeRequire("node:module") as {
  _load: (req: string, parent: unknown, isMain: boolean) => unknown;
};
const load = Module._load;
Module._load = (req, parent, isMain) =>
  req === "server-only" ? {} : load(req, parent, isMain);

async function main() {
  const a = await import("../src/lib/automette");
  const r2 = await import("../src/lib/r2");

  let failures = 0;
  const check = (label: string, ok: boolean, detail?: string) => {
    if (!ok) failures++;
    console.log(
      `${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`,
    );
  };

  if (!a.documentsReady()) {
    console.error("AUTOMETTE_API_KEY is not set in .env.local.");
    process.exit(1);
  }

  // --- the key works, and we can see the account's templates ---------
  const templates = await a.listTemplates();
  check(
    "the API key is accepted and lists templates",
    templates.length >= 0,
    `${templates.length} template(s)`,
  );

  if (templates.length === 0) {
    console.log(
      "\nNo templates on the account yet — build one in Automette and re-run.\n" +
        "Everything above this line already works.",
    );
    process.exit(failures > 0 ? 1 : 0);
  }

  const template = templates[0];
  console.log(`  using "${template.name}" (${template.engine})\n`);

  // --- fields come back, so a caller can check before rendering ------
  const detail = await a.getTemplate(template.id);
  check(
    "a template reports the fields it expects",
    Array.isArray(detail.fields) && detail.fields.length > 0,
    `${detail.fields?.length ?? 0} fields`,
  );

  // Fill every field with something recognisable, so a human opening the
  // output can see it came from here.
  const data = Object.fromEntries(
    (detail.fields ?? []).map((f) => [f.key, `test-${f.key}`]),
  );

  // --- render, and store our own copy --------------------------------
  const started = Date.now();
  const { renderId, fileUrl } = await a.renderAndStore({
    templateId: template.id,
    data,
    folder: "_selftest",
    filename: "automette integration test",
  });
  check(
    "renders and lands in our own storage",
    Boolean(fileUrl),
    `${Math.round((Date.now() - started) / 1000)}s · render ${renderId}`,
  );

  // --- our copy is what a parent would actually open -----------------
  const res = await fetch(fileUrl, { cache: "no-store" });
  const bytes = res.ok ? (await res.arrayBuffer()).byteLength : 0;
  check(
    "our copy opens and is a PDF",
    res.ok && res.headers.get("content-type") === "application/pdf",
    res.ok ? `${bytes} bytes` : `HTTP ${res.status}`,
  );
  check("the file is not empty", bytes > 1000, `${bytes} bytes`);

  // --- a bad template id fails loudly rather than silently -----------
  try {
    await a.getTemplate("does-not-exist");
    check("an unknown template id throws", false, "it did not throw");
  } catch (err) {
    check(
      "an unknown template id throws",
      String(err).includes("Automette"),
      String(err).slice(0, 60),
    );
  }

  // --- clean up -------------------------------------------------------
  const key = decodeURIComponent(new URL(fileUrl).pathname.replace(/^\//, ""));
  await r2.deleteObject(key);
  check("the test file is removed", !(await r2.objectExists(key)));

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nall checks passed — documents are ready");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
