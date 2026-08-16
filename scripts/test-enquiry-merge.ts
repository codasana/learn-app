/**
 * One family, one row — across all three ways in.
 *
 * The scenario that motivated this: a parent gives their email on the check
 * result, does not book, then comes back a week later and fills in /book.
 * Two inserts make that two families, and the check ends up attached to the
 * one nobody advances.
 *
 * Runs against the real database and cleans up after itself.
 */
import { createRequire } from "node:module";

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const nodeRequire = createRequire(import.meta.url);
const Module = nodeRequire("node:module") as {
  _load: (r: string, p: unknown, m: boolean) => unknown;
};
const load = Module._load;
Module._load = (r, p, m) => (r === "server-only" ? {} : load(r, p, m));

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}

const EMAIL = `merge-test-${Date.now()}@example.invalid`;

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const { enquiries } = await import("../src/db/schema");
  const { upsertEnquiry } = await import("../src/lib/enquiries");

  const count = async () =>
    (await db.select().from(enquiries).where(eq(enquiries.parentEmail, EMAIL))).length;
  const row = async () =>
    db.query.enquiries.findFirst({ where: eq(enquiries.parentEmail, EMAIL) });

  console.log("\nOne family, one row\n");

  // 1. the check: we have an email and a child's first name, nothing else
  const a = await upsertEnquiry({
    parentEmail: EMAIL.toUpperCase(), // also proves case folding
    parentName: "A Parent",
    childFirstName: "Nila",
    source: "tool",
  });
  check("the check creates the row", !a.merged);
  check("the address is folded to lower case", (await count()) === 1);

  // 2. a week later, the same parent fills in /book with more detail
  const b = await upsertEnquiry({
    parentEmail: EMAIL,
    parentName: "A Parent",
    whatsapp: "+971 50 000 0000",
    childGrade: 4,
    timezone: "Asia/Dubai",
    notes: "Would like evenings.",
    source: "demo_form",
    autometteSubmissionId: `sub-${Date.now()}`,
  });
  check("the form merges instead of inserting", b.merged);
  check("...into the same row", b.id === a.id);
  check("still one family", (await count()) === 1);

  const merged = await row();
  check("the child's name from the check survives", merged?.childFirstName === "Nila");
  check("the new WhatsApp number is filled in", merged?.whatsapp === "+971 50 000 0000");
  check("the timezone they told us is taken", merged?.timezone === "Asia/Dubai");
  check("the submission id is recorded", Boolean(merged?.autometteSubmissionId));

  // 3. later information must not clobber what is already there
  await upsertEnquiry({
    parentEmail: EMAIL,
    parentName: "Someone Else",
    childFirstName: "Wrong Child",
    notes: "Second note.",
    source: "demo_form",
  });
  const after = await row();
  check("a later name does not overwrite the first", after?.parentName === "A Parent");
  check("a later child name does not overwrite either", after?.childFirstName === "Nila");
  check("both notes are kept", (after?.notes ?? "").includes("Would like evenings.")
    && (after?.notes ?? "").includes("Second note."));

  // 4. declining, then coming back
  await db.update(enquiries)
    .set({ status: "declined", purgeAfter: "2027-01-01" })
    .where(eq(enquiries.id, a.id));
  await upsertEnquiry({ parentEmail: EMAIL, source: "demo_form" });
  const reopened = await row();
  check("a declined family coming back re-opens the row", reopened?.status === "new");
  check("...and the deletion clock is cleared", reopened?.purgeAfter === null);
  check("...without creating a second row", (await count()) === 1);

  // 5. an enrolled family enquiring again is a sibling, not a duplicate
  await db.update(enquiries).set({ status: "enrolled" }).where(eq(enquiries.id, a.id));
  const sibling = await upsertEnquiry({
    parentEmail: EMAIL,
    childFirstName: "Younger Sibling",
    source: "demo_form",
  });
  check("an enrolled family gets a NEW row for a sibling", !sibling.merged);
  check("...so there are two", (await count()) === 2);

  await db.delete(enquiries).where(eq(enquiries.parentEmail, EMAIL));
  check("cleaned up", (await count()) === 0);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
