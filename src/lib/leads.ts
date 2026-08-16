import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { enquiries, enquiryFamilies } from "@/db/schema";
import { loopsReady, sendEvent, upsertContact } from "@/lib/loops";

/**
 * What a family looks like to Loops.
 *
 * A Loops contact is keyed on email, which means it maps to a FAMILY and
 * never to one child. That is why the mirror's state lives on
 * `enquiry_families` — putting it on the child would give one contact several
 * conflicting stages, and whichever synced last would win.
 *
 * One direction only: our database decides the stage, we push it, and we
 * never read it back. Two systems owning one fact will disagree exactly when
 * it costs something.
 */

type Family = typeof enquiryFamilies.$inferSelect;
type Status = (typeof enquiries.$inferSelect)["status"];

/**
 * Our funnel names are for us; these are for whoever builds the automation.
 * `new` is a fine column value and a hopeless segment name — the person
 * writing "stop emailing anyone past X" should not have to remember that
 * `new` means "asked, has not booked".
 */
const STAGE: Record<Status, string> = {
  new: "enquired",
  class_scheduled: "class_booked",
  class_done: "class_done",
  report_sent: "report_sent",
  enrolled: "customer",
  declined: "declined",
  dormant: "dormant",
};

/**
 * How far through the funnel a stage is. Higher wins.
 *
 * A family with two children has two stages and one contact, so one has to
 * stand for both — and the only safe direction is the furthest along. An
 * elder child who has enrolled must stop the "still thinking?" sequence even
 * while a younger sibling is still an enquiry. Chasing a paying customer is a
 * worse failure than not chasing a warm lead.
 */
const RANK: Record<Status, number> = {
  declined: 0,
  dormant: 1,
  new: 2,
  class_scheduled: 3,
  class_done: 4,
  report_sent: 5,
  enrolled: 6,
};

/**
 * Transitions worth interrupting someone for, as opposed to states worth
 * filtering on.
 *
 * Deliberately sparse. An event per status change would give the automation
 * builder seven triggers, five of which are noise, and noise in a marketing
 * tool becomes mail nobody meant to send.
 */
const EVENT: Partial<Record<Status, string>> = {
  class_scheduled: "class_booked",
  enrolled: "enrolled",
  declined: "declined",
};

export function stageFor(status: Status): string {
  return STAGE[status] ?? status;
}

/** Loops wants these separately and we collect one field. */
function splitName(full: string | null): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

const SOURCE: Record<(typeof enquiries.$inferSelect)["source"], string> = {
  tool: "free_check",
  demo_form: "book_a_class",
  referral: "referral",
  other: "other",
};

/** The stage this family's contact should carry, given all their children. */
export function familyStage(statuses: Status[]): Status {
  return statuses.reduce<Status>(
    (best, s) => (RANK[s] > RANK[best] ? s : best),
    "declined",
  );
}

/**
 * Push one family's current state to Loops.
 *
 * Best-effort and self-recording. On success the stage we pushed is written
 * back to the family row, which is what lets scripts/sync-loops.ts find every
 * family whose mirror has drifted — a failed push here is a row to retry
 * later, not a lost customer.
 */
export async function syncFamily(
  family: Family,
): Promise<{ ok: boolean; error?: string }> {
  if (!loopsReady()) return { ok: true };

  const children = await db
    .select({
      status: enquiries.status,
      source: enquiries.source,
      childFirstName: enquiries.childFirstName,
      childAgeBand: enquiries.childAgeBand,
      classAt: enquiries.classAt,
    })
    .from(enquiries)
    .where(eq(enquiries.familyId, family.id));

  if (children.length === 0) return { ok: true };

  const furthest = familyStage(children.map((c) => c.status));
  const stage = stageFor(furthest);
  const { first, last } = splitName(family.parentName);

  // The child the automation should talk about is the one furthest along.
  const lead = children.find((c) => c.status === furthest) ?? children[0];
  const names = children
    .map((c) => c.childFirstName)
    .filter((n): n is string => Boolean(n));

  const res = await upsertContact(family.parentEmail, {
    firstName: first || null,
    lastName: last || null,
    leadStage: stage,
    source: SOURCE[lead.source] ?? lead.source,
    childFirstName: lead.childFirstName,
    // Every child we know of on this address, so a sequence can say "your
    // children" rather than naming whichever row synced last.
    children: names.join(", ") || null,
    childCount: children.length,
    childAgeBand: lead.childAgeBand,
    timezone: family.timezone,
    classAt: lead.classAt ? lead.classAt.toISOString() : null,
    familyId: family.id,
  });

  if (!res.ok) {
    console.error(`[loops] ${family.parentEmail} → ${stage} FAILED`, res.error);
    return { ok: false, error: res.error };
  }

  /*
   * The event fires on a TRANSITION, not on every save — Sheeba correcting a
   * typo in her notes must not re-trigger the "class booked" mail. The stage
   * we last pushed is what makes that comparison possible.
   */
  const event = EVENT[furthest];
  if (event && family.loopsStage !== stage) {
    const sent = await sendEvent(family.parentEmail, event, {
      stage,
      ...(lead.classAt ? { classAt: lead.classAt.toISOString() } : {}),
    });
    // The property is already correct, so a dropped event costs the immediate
    // mail and nothing else. Not worth failing the sync over.
    if (!sent.ok) console.error(`[loops] event ${event} FAILED`, sent.error);
  }

  await db
    .update(enquiryFamilies)
    .set({ loopsStage: stage, loopsSyncedAt: new Date() })
    .where(eq(enquiryFamilies.id, family.id));

  return { ok: true };
}

/** Callers hold an enquiry id; Loops needs the family behind it. */
export async function syncLeadById(enquiryId: string) {
  const [row] = await db
    .select({ family: enquiryFamilies })
    .from(enquiries)
    .innerJoin(enquiryFamilies, eq(enquiryFamilies.id, enquiries.familyId))
    .where(eq(enquiries.id, enquiryId))
    .limit(1);
  if (!row) return { ok: false, error: "no such enquiry" };
  return syncFamily(row.family);
}

export async function syncFamilyById(familyId: string) {
  const family = await db.query.enquiryFamilies.findFirst({
    where: eq(enquiryFamilies.id, familyId),
  });
  if (!family) return { ok: false, error: "no such family" };
  return syncFamily(family);
}
