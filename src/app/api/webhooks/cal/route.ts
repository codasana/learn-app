import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { enquiries } from "@/db/schema";
import { parseCalBooking, verifyCalWebhook } from "@/lib/cal-webhooks";
import { syncLead } from "@/lib/leads";

/**
 * Where a booked free session arrives from Cal.com.
 *
 * This is what makes the funnel close itself. Without it, a parent books a
 * time and the only two systems that need to know — the enquiry list Sheeba
 * works from, and the Loops automation still chasing them — both carry on as
 * if nothing happened.
 *
 * Same reply discipline as the Automette webhook: 4xx only for "this was not
 * from you", 200 for anything understood and deliberately not acted on, and a
 * non-2xx reserved for our own failures, where a retry might actually help.
 */
export async function POST(req: Request) {
  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const raw = await req.text();

  const verified = verifyCalWebhook(raw, req.headers, secret);
  if (!verified.ok) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const booking = parseCalBooking(raw);
  if (!booking) return NextResponse.json({ ok: true, ignored: true });

  /*
   * Matching a booking to an enquiry.
   *
   * Two ways, and the order matters.
   *
   * The id is the reliable one. Every booking link we generate carries the
   * enquiry id, so a parent arriving from the check result or the
   * confirmation email hands it straight back and there is nothing to infer.
   *
   * Email is the fallback, for anyone who reached the plain booking page —
   * forwarded by a friend, or found however people find things. It is a
   * guess: book with a different address and it fails. The awkward case is a
   * parent who enquired twice, leaving two rows on one address; newest wins,
   * because a booking made today belongs to today's conversation.
   *
   * No match at all is normal rather than an error. We record nothing rather
   * than invent a lead we know nothing about, and the booking still exists in
   * Cal.com where Sheeba can see it.
   */
  const enquiry = booking.enquiryId
    ? await db.query.enquiries.findFirst({
        where: eq(enquiries.id, booking.enquiryId),
      })
    : booking.attendeeEmail
      ? await db.query.enquiries.findFirst({
          where: eq(enquiries.parentEmail, booking.attendeeEmail),
          orderBy: [desc(enquiries.createdAt)],
        })
      : null;

  if (!enquiry) {
    return NextResponse.json({
      ok: true,
      unmatched: booking.enquiryId ? "enquiry gone" : "no match",
    });
  }

  const cancelled = booking.trigger === "BOOKING_CANCELLED";

  /*
   * Cal.com has no timestamp in its signed material, so a captured delivery
   * can be replayed at us forever (see src/lib/cal-webhooks.ts). Idempotence
   * is the defence: this writes the same values for the same payload however
   * many times it arrives, and never appends.
   *
   * Cancelling does NOT walk the status back to `new`. A parent who booked
   * and cancelled is not in the same place as one who never booked, and
   * quietly re-arming the "have you booked yet?" sequence on them is exactly
   * the sort of tone-deaf automation this integration exists to avoid.
   * Sheeba decides what that means, from a row that now says so.
   */
  await db
    .update(enquiries)
    .set({
      calBookingId: cancelled ? null : booking.bookingId,
      classAt: cancelled ? null : new Date(booking.startTime),
      status:
        cancelled || enquiry.status !== "new" ? enquiry.status : "class_scheduled",
      // The parent's own timezone, straight from their booking — better than
      // the one we guessed on a form.
      timezone: booking.attendeeTimezone ?? enquiry.timezone,
      updatedAt: new Date(),
    })
    .where(eq(enquiries.id, enquiry.id));

  const updated = await db.query.enquiries.findFirst({
    where: eq(enquiries.id, enquiry.id),
  });
  if (updated) await syncLead(updated, { previousStage: enquiry.loopsStage });

  return NextResponse.json({ ok: true, enquiryId: enquiry.id });
}
