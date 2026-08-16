/**
 * Push every family whose Loops mirror has drifted.
 *
 * Live syncs are best-effort by design — a Loops outage must never fail a
 * parent's form submission — which means some pushes are simply lost. This is
 * what makes that recoverable rather than permanent: `loops_stage` records the
 * stage we last successfully pushed, so anything where it differs from
 * `status` is stale by definition and can be found without guessing.
 *
 * Safe to run as often as you like; it is a no-op when everything agrees.
 * Worth a daily cron once real leads exist, because the failure it repairs is
 * silent and the symptom — a customer still getting "still thinking?" mail —
 * shows up on the parent's side rather than ours.
 *
 *   npx tsx scripts/sync-loops.ts            # push what has drifted
 *   npx tsx scripts/sync-loops.ts --dry-run  # show it, change nothing
 *   npx tsx scripts/sync-loops.ts --all      # re-push everything
 */
import { createRequire } from "node:module";

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const nodeRequire = createRequire(import.meta.url);
const Module = nodeRequire("node:module") as {
  _load: (req: string, parent: unknown, isMain: boolean) => unknown;
};
const load = Module._load;
Module._load = (req, parent, isMain) =>
  req === "server-only" ? {} : load(req, parent, isMain);

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const all = process.argv.includes("--all");

  const { db } = await import("../src/db");
  const { enquiries, enquiryFamilies } = await import("../src/db/schema");
  const { loopsReady, testKey } = await import("../src/lib/loops");
  const { syncFamily, stageFor, familyStage } = await import("../src/lib/leads");
  const { eq } = await import("drizzle-orm");

  if (!loopsReady()) {
    console.error("LOOPS_API_KEY is not set. Nothing to do.");
    process.exit(1);
  }

  const key = await testKey();
  if (!key.ok) {
    console.error(`Loops rejected the API key: ${key.error}`);
    process.exit(1);
  }

  const families = await db.select().from(enquiryFamilies);

  // A family's contact carries the stage of whichever child is furthest
  // along, so drift has to be measured against that, not against any one row.
  const wanted = new Map<string, string>();
  for (const f of families) {
    const kids = await db
      .select({ status: enquiries.status })
      .from(enquiries)
      .where(eq(enquiries.familyId, f.id));
    if (kids.length === 0) continue;
    wanted.set(f.id, stageFor(familyStage(kids.map((k) => k.status))));
  }

  const drifted = families.filter(
    (f) => wanted.has(f.id) && (all || f.loopsStage !== wanted.get(f.id)),
  );

  console.log(
    `${families.length} families · ${wanted.size} with a child · ${drifted.length} to push`,
  );

  let ok = 0;
  let failed = 0;

  for (const f of drifted) {
    const to = wanted.get(f.id);
    const from = f.loopsStage ?? "never synced";
    const label = `${f.parentEmail}  ${from} → ${to}`;

    if (dryRun) {
      console.log(`  would push  ${label}`);
      continue;
    }

    /*
     * No event on a reconcile run: these transitions already happened, some
     * days ago, and firing "class booked" now would congratulate a parent on
     * a session they have already sat through. Writing the target stage onto
     * the row first makes syncFamily see no transition.
     */
    await db
      .update(enquiryFamilies)
      .set({ loopsStage: to })
      .where(eq(enquiryFamilies.id, f.id));

    const res = await syncFamily({ ...f, loopsStage: to ?? null });
    if (res.ok) {
      ok++;
      console.log(`  pushed      ${label}`);
    } else {
      failed++;
      console.log(`  FAILED      ${label} — ${res.error}`);
    }
  }

  if (!dryRun) console.log(`\n${ok} pushed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
