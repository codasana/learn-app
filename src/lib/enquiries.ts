import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { enquiries, enquiryFamilies } from "@/db/schema";

/**
 * Writing an enquiry. The only way one gets written.
 *
 * There are three ways in and they do not know about each other: the free
 * check, the "book a free session" form, and Sheeba typing someone in. The
 * same family will use more than one, and the case that caught us was:
 *
 *   1. Child takes the check, parent gives their email → enquiry, check
 *      attached, booking link emailed.
 *   2. They do not book.
 *   3. A week later the parent comes back and fills in /book.
 *
 * Blind inserts make that two families, and Loops — which upserts on email —
 * silently restarts the nurture sequence on someone already halfway through.
 *
 * **Email identifies the family. A child's first name identifies nothing.**
 * That distinction is the whole design. We control every place an address is
 * collected and we send to it; a first name is free text a stranger types,
 * and "Nila", "Neela" and "Nila S" are three keys for one child. So the
 * family is looked up by email, and the child is *matched* by name only as a
 * best guess — one whose worst case is a duplicate row a human can see and
 * fix, never a wrong merge that silently overwrites someone's record.
 *
 * NOTE this is a different question from matching a Cal.com booking, which
 * prefers the enquiry id carried on the link, because a parent may book under
 * an address they never gave us. Email says which family; the id says which
 * child's conversation.
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

/** "Nila " and "nila" are the same child. Nothing else is compared. */
function sameChild(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

export async function upsertEnquiry(
  incoming: Incoming,
): Promise<{ id: string; familyId: string; merged: boolean }> {
  const email = incoming.parentEmail.trim().toLowerCase();
  const child = incoming.childFirstName?.trim() || null;

  /* --- the family, by email ---------------------------------------- */

  const existingFamily = await db.query.enquiryFamilies.findFirst({
    where: eq(enquiryFamilies.parentEmail, email),
  });

  let familyId: string;
  if (existingFamily) {
    /*
     * Held once, so there is one answer to "what is their number" whichever
     * child you are looking at. Newer beats older for the things that
     * genuinely change — a phone number, a timezone they have moved to —
     * while a name we already have is not replaced by a later blank.
     */
    await db
      .update(enquiryFamilies)
      .set({
        parentName: fill(existingFamily.parentName, incoming.parentName),
        whatsapp: incoming.whatsapp ?? existingFamily.whatsapp,
        timezone: incoming.timezone ?? existingFamily.timezone,
        updatedAt: new Date(),
      })
      .where(eq(enquiryFamilies.id, existingFamily.id));
    familyId = existingFamily.id;
  } else {
    const [row] = await db
      .insert(enquiryFamilies)
      .values({
        parentEmail: email,
        parentName: incoming.parentName ?? null,
        whatsapp: incoming.whatsapp ?? null,
        timezone: incoming.timezone ?? "Asia/Kolkata",
      })
      .returning({ id: enquiryFamilies.id });
    familyId = row.id;
  }

  /* --- which child's conversation ----------------------------------- */

  const children = await db
    .select()
    .from(enquiries)
    .where(eq(enquiries.familyId, familyId))
    .orderBy(desc(enquiries.createdAt));

  /*
   * With a name, only that child's row counts — a sibling's row must never
   * absorb them. Without one, the most recent open row is the best guess:
   * the /book form leaves the child's name optional, and a parent filling it
   * in twice is far likelier to be chasing the same child than to have
   * quietly acquired another.
   */
  const existing = child
    ? children.find((e) => sameChild(e.childFirstName, child))
    : children.find((e) => e.status !== "enrolled");

  /*
   * A fresh row for a child we have not heard of — including a sibling of a
   * family we know, and including an already-enrolled child whose parent
   * enquires again, which is almost always next term rather than a
   * correction to a paying customer's record.
   */
  if (!existing || existing.status === "enrolled") {
    const [row] = await db
      .insert(enquiries)
      .values({
        familyId,
        childFirstName: child,
        childAgeBand: incoming.childAgeBand ?? null,
        childGrade: incoming.childGrade ?? null,
        source: incoming.source,
        notes: incoming.notes ?? null,
        autometteSubmissionId: incoming.autometteSubmissionId ?? null,
        status: "new",
      })
      .returning({ id: enquiries.id });
    return { id: row.id, familyId, merged: false };
  }

  /*
   * Someone we turned away, or who went quiet, coming back is a re-open
   * rather than a fresh lead. Keeping the row keeps the history — including
   * what Sheeba wrote about them last time, which is exactly what she wants
   * to read before replying. Re-opening also clears the deletion clock that
   * declining started, which now lives on the family.
   */
  const reopening = existing.status === "declined" || existing.status === "dormant";

  await db
    .update(enquiries)
    .set({
      childFirstName: fill(existing.childFirstName, child),
      childAgeBand: fill(existing.childAgeBand, incoming.childAgeBand),
      childGrade: fill(existing.childGrade, incoming.childGrade),
      // Two notes are worth more than one, and neither is worth losing.
      notes: [existing.notes, incoming.notes].filter(Boolean).join("\n\n") || null,
      autometteSubmissionId:
        incoming.autometteSubmissionId ?? existing.autometteSubmissionId,
      ...(reopening ? { status: "new" as const } : {}),
      updatedAt: new Date(),
    })
    .where(eq(enquiries.id, existing.id));

  if (reopening) {
    await db
      .update(enquiryFamilies)
      .set({ purgeAfter: null, updatedAt: new Date() })
      .where(eq(enquiryFamilies.id, familyId));
  }

  return { id: existing.id, familyId, merged: true };
}

/** An enquiry with its family attached — what nearly every caller wants. */
export async function enquiryWithFamily(id: string) {
  const [row] = await db
    .select({ enquiry: enquiries, family: enquiryFamilies })
    .from(enquiries)
    .innerJoin(enquiryFamilies, eq(enquiryFamilies.id, enquiries.familyId))
    .where(eq(enquiries.id, id))
    .limit(1);
  return row;
}

/** The family's other children, for the teacher's screen. */
export async function siblingsOf(enquiryId: string, familyId: string) {
  return db
    .select({
      id: enquiries.id,
      childFirstName: enquiries.childFirstName,
      status: enquiries.status,
    })
    .from(enquiries)
    .where(and(eq(enquiries.familyId, familyId), ne(enquiries.id, enquiryId)))
    .orderBy(desc(enquiries.createdAt));
}
