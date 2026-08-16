/**
 * One family per email, one row per child.
 *
 * Two scenarios drove the split. A parent gives their email on the check
 * result, does not book, then comes back a week later and fills in /book —
 * blind inserts make that two families. And that same parent enquires about
 * a second child — which a family-shaped row with the child embedded cannot
 * represent at all.
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
  const { enquiries, enquiryFamilies } = await import("../src/db/schema");
  const { upsertEnquiry, siblingsOf } = await import("../src/lib/enquiries");
  const { familyStage, stageFor } = await import("../src/lib/leads");

  const family = async () =>
    db.query.enquiryFamilies.findFirst({
      where: eq(enquiryFamilies.parentEmail, EMAIL),
    });
  const kids = async (familyId: string) =>
    db.select().from(enquiries).where(eq(enquiries.familyId, familyId));

  console.log("\nOne family per email\n");

  // 1. the check: an email, a child's first name, nothing else
  const a = await upsertEnquiry({
    parentEmail: EMAIL.toUpperCase(), // also proves case folding
    parentName: "A Parent",
    childFirstName: "Nila",
    source: "tool",
  });
  check("the check creates a family", Boolean(await family()));
  check("...and one child", (await kids(a.familyId)).length === 1);
  check("the address is folded to lower case", (await family())?.parentEmail === EMAIL);

  // 2. a week later, the same parent fills in /book about the same child
  const b = await upsertEnquiry({
    parentEmail: EMAIL,
    parentName: "A Parent",
    whatsapp: "+971 50 000 0000",
    childFirstName: "nila ", // scruffier typing, same child
    childGrade: 4,
    timezone: "Asia/Dubai",
    notes: "Would like evenings.",
    source: "demo_form",
    autometteSubmissionId: `sub-${Date.now()}`,
  });
  check("a scruffier spelling still finds the same child", b.merged && b.id === a.id);
  check("no second family", b.familyId === a.familyId);
  check("still one child", (await kids(a.familyId)).length === 1);

  const f2 = await family();
  check("the parent's number lands on the family", f2?.whatsapp === "+971 50 000 0000");
  check("the timezone they told us is taken", f2?.timezone === "Asia/Dubai");

  const first = (await kids(a.familyId))[0];
  check("the grade lands on the child", first.childGrade === 4);
  check("the submission id is recorded", Boolean(first.autometteSubmissionId));

  console.log("\nOne row per child\n");

  // 3. the same parent, a different child
  const sib = await upsertEnquiry({
    parentEmail: EMAIL,
    childFirstName: "Arjun",
    childAgeBand: "8_9",
    source: "demo_form",
  });
  check("a sibling gets their own row", !sib.merged && sib.id !== a.id);
  check("...in the same family", sib.familyId === a.familyId);
  check("two children now", (await kids(a.familyId)).length === 2);

  const others = await siblingsOf(a.id, a.familyId);
  check(
    "the teacher's screen can see the sibling",
    others.length === 1 && others[0].childFirstName === "Arjun",
  );

  // 4. the two move independently — the thing the old shape could not do
  await db.update(enquiries).set({ status: "enrolled" }).where(eq(enquiries.id, a.id));
  const both = await kids(a.familyId);
  check(
    "one child enrolled while the other is still new",
    both.filter((k) => k.status === "enrolled").length === 1 &&
      both.filter((k) => k.status === "new").length === 1,
  );
  check(
    "the family's Loops stage takes the furthest along",
    stageFor(familyStage(both.map((k) => k.status))) === "customer",
  );

  // 5. later information never overwrites what is already there
  await upsertEnquiry({
    parentEmail: EMAIL,
    parentName: "Someone Else",
    childFirstName: "Arjun",
    notes: "Second note.",
    source: "demo_form",
  });
  check(
    "a later parent name does not overwrite the first",
    (await family())?.parentName === "A Parent",
  );
  const arjun = (await kids(a.familyId)).find((k) => k.childFirstName === "Arjun");
  check("both notes are kept", (arjun?.notes ?? "").includes("Second note."));

  // 6. declining, then coming back
  await db.update(enquiries).set({ status: "declined" }).where(eq(enquiries.id, arjun!.id));
  await db
    .update(enquiryFamilies)
    .set({ purgeAfter: "2027-01-01" })
    .where(eq(enquiryFamilies.id, a.familyId));

  await upsertEnquiry({ parentEmail: EMAIL, childFirstName: "Arjun", source: "demo_form" });
  const back = (await kids(a.familyId)).find((k) => k.childFirstName === "Arjun");
  check("a declined child coming back re-opens their row", back?.status === "new");
  check(
    "...and the family's deletion clock is cleared",
    (await family())?.purgeAfter === null,
  );
  check("...without creating a third row", (await kids(a.familyId)).length === 2);

  // 7. an enrolled child enquired about again is next term, not a correction
  const again = await upsertEnquiry({
    parentEmail: EMAIL,
    childFirstName: "Nila",
    source: "demo_form",
  });
  check("an enrolled child gets a fresh row", !again.merged);
  check("...so three rows, still one family", (await kids(a.familyId)).length === 3);

  // 8. the family owns its children
  await db.delete(enquiryFamilies).where(eq(enquiryFamilies.id, a.familyId));
  check(
    "deleting the family cascades to every child",
    (await kids(a.familyId)).length === 0,
  );
  check("cleaned up", !(await family()));

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
