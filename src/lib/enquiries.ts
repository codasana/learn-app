import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { enquiries } from "@/db/schema";

/**
 * One family, one row — keyed on the parent's email.
 *
 * There are three ways in and they don't know about each other: the free
 * check, the "book a free session" form, and Sheeba typing someone in. The
 * same family will use more than one. The case that caught us:
 *
 *   1. Child takes the check, parent gives their email → enquiry, check
 *      attached, booking link emailed.
 *   2. They don't book.
 *   3. A week later the parent comes back and fills in /book.
 *
 * Blind inserts make that two families. Sheeba sees two rows for one child,
 * the check is attached to the older one, and whichever row the parent
 * eventually books against is the one that advances — leaving the other
 * "new" forever. Loops is worse: it upserts on email, so the second enquiry
 * silently overwrites the first's stage and the automation starts chasing a
 * family that is already halfway through.
 *
 * So email is the identity, and this is the only way an enquiry gets written.
 *
 * NOTE this is a different question from matching a Cal.com booking, which
 * prefers the enquiry id carried on the link — because a parent may book
 * under an address they never gave us. Email identifies the family we know;
 * the id identifies the conversation. Both are needed.
 */

type Incoming = {
  parentEmail: string;
  parentName?: string | null;
  whatsapp?: string | null;
  childFirstName?: string | null;
  childAgeBand?: "8_9" | "10_11" | "any" | null;
  childGrade?: number | null;
  timezone?: string | null;
  notes?: string | null;
  source: typeof enquiries.$inferInsert.source;
  autometteSubmissionId?: string | null;
};

/** Later information fills a gap; it never overwrites something already there. */
function fill<T>(existing: T | null | undefined, incoming: T | null | undefined) {
  return existing ?? incoming ?? null;
}

export async function upsertEnquiry(
  incoming: Incoming,
): Promise<{ id: string; merged: boolean }> {
  const email = incoming.parentEmail.trim().toLowerCase();

  const existing = await db.query.enquiries.findFirst({
    where: eq(enquiries.parentEmail, email),
    orderBy: [desc(enquiries.createdAt)],
  });

  /*
   * An enrolled family enquiring again is not a duplicate — it is almost
   * always a sibling, or the next term. Merging would bury a new child inside
   * a paying customer's row and lose the enquiry entirely.
   */
  if (!existing || existing.status === "enrolled") {
    const [row] = await db
      .insert(enquiries)
      .values({
        parentEmail: email,
        parentName: incoming.parentName ?? null,
        whatsapp: incoming.whatsapp ?? null,
        childFirstName: incoming.childFirstName ?? null,
        childAgeBand: incoming.childAgeBand ?? null,
        childGrade: incoming.childGrade ?? null,
        timezone: incoming.timezone ?? "Asia/Kolkata",
        source: incoming.source,
        notes: incoming.notes ?? null,
        autometteSubmissionId: incoming.autometteSubmissionId ?? null,
        status: "new",
      })
      .returning({ id: enquiries.id });
    return { id: row.id, merged: false };
  }

  /*
   * Someone we turned away, or who went quiet, coming back is a re-open
   * rather than a fresh lead. Keeping the row keeps the history — including
   * what Sheeba wrote about them last time, which is exactly what she wants
   * to read before replying. Re-opening also has to clear the deletion clock
   * that declining started.
   */
  const reopening = existing.status === "declined" || existing.status === "dormant";

  await db
    .update(enquiries)
    .set({
      parentName: fill(existing.parentName, incoming.parentName),
      whatsapp: fill(existing.whatsapp, incoming.whatsapp),
      childFirstName: fill(existing.childFirstName, incoming.childFirstName),
      childAgeBand: fill(existing.childAgeBand, incoming.childAgeBand),
      childGrade: fill(existing.childGrade, incoming.childGrade),
      // A timezone is always set, so "unchanged unless they told us again".
      timezone: incoming.timezone ?? existing.timezone,
      // Two notes are worth more than one, and neither is worth losing.
      notes: [existing.notes, incoming.notes].filter(Boolean).join("\n\n") || null,
      autometteSubmissionId:
        incoming.autometteSubmissionId ?? existing.autometteSubmissionId,
      ...(reopening ? { status: "new" as const, purgeAfter: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(enquiries.id, existing.id));

  return { id: existing.id, merged: true };
}
