/**
 * Push every lead whose Loops mirror has drifted.
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
  const { enquiries } = await import("../src/db/schema");
  const { loopsReady, testKey } = await import("../src/lib/loops");
  const { syncLead, stageFor } = await import("../src/lib/leads");

  if (!loopsReady()) {
    console.error("LOOPS_API_KEY is not set. Nothing to do.");
    process.exit(1);
  }

  const key = await testKey();
  if (!key.ok) {
    console.error(`Loops rejected the API key: ${key.error}`);
    process.exit(1);
  }

  const rows = await db.select().from(enquiries);
  const withEmail = rows.filter((r) => r.parentEmail);

  const drifted = all
    ? withEmail
    : withEmail.filter((r) => r.loopsStage !== stageFor(r.status));

  console.log(
    `${rows.length} enquiries · ${withEmail.length} with an address · ${drifted.length} to push`,
  );

  let ok = 0;
  let failed = 0;

  for (const row of drifted) {
    const to = stageFor(row.status);
    const from = row.loopsStage ?? "never synced";
    const label = `${row.parentEmail}  ${from} → ${to}`;

    if (dryRun) {
      console.log(`  would push  ${label}`);
      continue;
    }

    // No event on a reconcile run: these transitions already happened, some
    // of them days ago, and firing "class booked" now would send a parent a
    // congratulations mail about a class they have already sat through.
    const res = await syncLead(row, { previousStage: to });
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
