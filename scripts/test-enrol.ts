/**
 * Converting an enquiry into a learning child.
 *
 * The moment the business is built on, and the one that used to lose the
 * most: the check result, the session notes and the placement decision all
 * stayed on the enquiry while a blank child record started beside them.
 *
 * Runs against the real database and cleans up after itself.
 */
import { createRequire } from "node:module";

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const nodeRequire = createRequire(import.meta.url);
const M = nodeRequire("node:module") as {
  _load: (r: string, p: unknown, m: boolean) => unknown;
};
const load = M._load;
M._load = (r, p, m) => (r === "server-only" ? {} : load(r, p, m));

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}

const EMAIL = `enrol-test-${Date.now()}@example.invalid`;

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const s = await import("../src/db/schema");
  const { upsertEnquiry } = await import("../src/lib/enquiries");
  const { createFamilyAccounts, CONSENT_VERSION } = await import(
    "../src/lib/family-accounts"
  );

  console.log("\nEnquiry → enrolled child\n");

  const a = await upsertEnquiry({
    parentEmail: EMAIL,
    parentName: "A Parent",
    whatsapp: "+91 90000 00000",
    timezone: "Asia/Dubai",
    childFirstName: "Nila",
    childAgeBand: "10_11",
    source: "tool",
  });

  const first = await createFamilyAccounts({
    parentEmail: EMAIL,
    parentName: "A Parent",
    whatsapp: "+91 90000 00000",
    timezone: "Asia/Dubai",
    childFirstName: "Nila",
    childAgeBand: "10_11",
    avatar: "fox",
    fromEnquiryId: a.id,
    consentNote: "Confirmed on WhatsApp, 16 Aug.",
  });
  check("enrolling succeeds", first.ok, first.ok ? "" : first.error);
  if (!first.ok) return report();

  check("a one-time password is returned for a new parent",
    Boolean(first.parentPassword));

  const child = await db.query.childProfiles.findFirst({
    where: eq(s.childProfiles.id, first.childId),
  });
  check("the child remembers which enquiry they came from",
    child?.fromEnquiryId === a.id);
  check("consent is timestamped", Boolean(child?.consentAt));
  check("...against a named version", child?.consentVersion === CONSENT_VERSION);
  check("...with how it was obtained", (child?.consentNote ?? "").includes("WhatsApp"));

  const parent = await db.query.users.findFirst({
    where: eq(s.users.id, first.parentId),
  });
  check("the parent's timezone came from the enquiry",
    parent?.timezone === "Asia/Dubai");
  check("...and their WhatsApp number too",
    parent?.whatsapp === "+91 90000 00000");
  check("the parent is a parent, not a student", parent?.role === "parent");

  // A sibling enrolled later must reuse the account, not make a second one.
  const b = await upsertEnquiry({
    parentEmail: EMAIL, childFirstName: "Arjun", source: "demo_form",
  });
  const second = await createFamilyAccounts({
    parentEmail: EMAIL,
    parentName: "A Parent",
    timezone: "Asia/Dubai",
    childFirstName: "Arjun",
    childAgeBand: "8_9",
    avatar: "owl",
    fromEnquiryId: b.id,
  });
  check("a sibling enrols too", second.ok);
  if (second.ok) {
    check("...onto the SAME parent account", second.parentId === first.parentId);
    check("...with no new password", second.parentPassword === null);
    const kids = await db
      .select()
      .from(s.childProfiles)
      .where(eq(s.childProfiles.parentId, first.parentId));
    check("...so the parent has two children", kids.length === 2);
    const arjun = kids.find((k) => k.firstName === "Arjun");
    check("consent left blank stays blank rather than implied",
      arjun?.consentAt === null && arjun?.consentNote === null);
  }

  // Deleting the funnel must not touch the learning side.
  await db.delete(s.enquiryFamilies).where(eq(s.enquiryFamilies.parentEmail, EMAIL));
  const survivor = await db.query.childProfiles.findFirst({
    where: eq(s.childProfiles.id, first.childId),
  });
  check("purging the enquiry leaves the child untouched", Boolean(survivor));
  check("...holding an id that now resolves to nothing",
    survivor?.fromEnquiryId === a.id);

  // clean up the learning side
  await db.delete(s.childProfiles).where(eq(s.childProfiles.parentId, first.parentId));
  await db.delete(s.users).where(eq(s.users.id, first.parentId));
  const gone = await db.query.users.findFirst({ where: eq(s.users.id, first.parentId) });
  check("cleaned up", !gone);

  report();
}

function report() {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
