import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { enquiries } from "@/db/schema";
import { loopsReady, sendEvent, upsertContact } from "@/lib/loops";

/**
 * What a lead looks like to Loops.
 *
 * One direction only: `enquiries.status` decides the stage, we push it, and
 * we never read it back. See the comment on `enquiries.loopsStage`.
 */

type Enquiry = typeof enquiries.$inferSelect;

/**
 * Our funnel names are for us; these are for whoever is building the
 * automation. `new` is a fine column value and a hopeless segment name — the
 * person writing "stop emailing anyone past X" should not have to remember
 * that `new` means "asked, has not booked".
 */
const STAGE: Record<Enquiry["status"], string> = {
  new: "enquired",
  class_scheduled: "class_booked",
  class_done: "class_done",
  report_sent: "report_sent",
  enrolled: "customer",
  declined: "declined",
  dormant: "dormant",
};

/**
 * Transitions worth interrupting someone for, as opposed to states worth
 * filtering on.
 *
 * Deliberately sparse. An event per status change would give the automation
 * builder seven triggers, five of which are noise, and noise in a marketing
 * tool becomes mail nobody meant to send.
 */
const EVENT: Partial<Record<Enquiry["status"], string>> = {
  class_scheduled: "class_booked",
  enrolled: "enrolled",
  declined: "declined",
};

export function stageFor(status: Enquiry["status"]): string {
  return STAGE[status] ?? status;
}

/** Loops wants these separately and we collect one field. */
function splitName(full: string | null): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

const SOURCE: Record<Enquiry["source"], string> = {
  tool: "free_check",
  demo_form: "book_a_class",
  referral: "referral",
  other: "other",
};

/**
 * Push one lead's current state to Loops.
 *
 * Best-effort and self-recording. On success the stage we pushed is written
 * back to the row, which is what lets scripts/sync-loops.ts find every lead
 * whose mirror has drifted — a failed push here is a row to retry later, not
 * a lost family.
 *
 * `previousStage` exists so the event fires on a TRANSITION rather than on
 * every save. Sheeba correcting a typo in her notes must not re-trigger the
 * "class booked" mail.
 */
export async function syncLead(
  enquiry: Enquiry,
  opts: { previousStage?: string | null } = {},
): Promise<{ ok: boolean; error?: string }> {
  if (!enquiry.parentEmail) return { ok: true };
  if (!loopsReady()) return { ok: true };

  const stage = stageFor(enquiry.status);
  const { first, last } = splitName(enquiry.parentName);

  const res = await upsertContact(enquiry.parentEmail, {
    firstName: first || null,
    lastName: last || null,
    leadStage: stage,
    source: SOURCE[enquiry.source] ?? enquiry.source,
    childFirstName: enquiry.childFirstName,
    childAgeBand: enquiry.childAgeBand,
    timezone: enquiry.timezone,
    classAt: enquiry.classAt ? enquiry.classAt.toISOString() : null,
    enquiryId: enquiry.id,
  });

  if (!res.ok) {
    console.error(`[loops] ${enquiry.parentEmail} → ${stage} FAILED`, res.error);
    return { ok: false, error: res.error };
  }

  const before = opts.previousStage ?? enquiry.loopsStage;
  const event = EVENT[enquiry.status];
  if (event && before !== stage) {
    const sent = await sendEvent(enquiry.parentEmail, event, {
      stage,
      ...(enquiry.classAt ? { classAt: enquiry.classAt.toISOString() } : {}),
    });
    // The property is already correct, so a dropped event costs the immediate
    // mail and nothing else. Not worth failing the sync over.
    if (!sent.ok) console.error(`[loops] event ${event} FAILED`, sent.error);
  }

  await db
    .update(enquiries)
    .set({ loopsStage: stage, loopsSyncedAt: new Date() })
    .where(eq(enquiries.id, enquiry.id));

  return { ok: true };
}

/** The common case: we have an id and want the mirror caught up. */
export async function syncLeadById(id: string) {
  const row = await db.query.enquiries.findFirst({
    where: eq(enquiries.id, id),
  });
  if (!row) return { ok: false, error: "no such enquiry" };
  return syncLead(row);
}
