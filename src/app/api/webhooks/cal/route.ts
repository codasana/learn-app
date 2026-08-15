import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { enquiries } from "@/db/schema";
import { parseCalBooking, verifyCalWebhook } from "@/lib/cal-webhooks";
import { syncLead } from "@/lib/leads";

/**
 * Where a booked free class arrives from Cal.com.
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

  if (!booking.attendeeEmail) {
    // Nothing to match on. Not an error, and retrying will not add an email.
    return NextResponse.json({ ok: true, unmatched: "no attendee email" });
  }

  /*
   * Matching a booking to an enquiry, by email.
   *
   * It is the only handle we have: Cal.com is a hosted booking page and the
   * parent reaches it from a link in an email, carrying nothing of ours.
   *
   * The awkward case is a parent who enquires twice — took the check in
   * October, came back in January — leaving two rows on one address. Newest
   * wins, because a booking made today belongs to the conversation happening
   * today.
   *
   * A booking with no matching enquiry is normal, not an error: someone can
   * be sent the booking link directly, or by another parent. We record
   * nothing rather than inventing a lead we know nothing about, and Sheeba
   * still has the booking in Cal.com itself.
   */
  const enquiry = await db.query.enquiries.findFirst({
    where: eq(enquiries.parentEmail, booking.attendeeEmail),
    orderBy: [desc(enquiries.createdAt)],
  });

  if (!enquiry) {
    return NextResponse.json({ ok: true, unmatched: "no enquiry" });
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
