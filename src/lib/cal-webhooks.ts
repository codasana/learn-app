import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifying a webhook from Cal.com.
 *
 * A different scheme from Automette's, and worth stating rather than
 * assuming: Cal.com signs the raw body ALONE — no id, no timestamp — as
 * hex-encoded HMAC-SHA256 in `x-cal-signature-256`.
 *
 * The absence of a timestamp is the thing to notice. Automette's scheme lets
 * us refuse a replay by age; this one cannot, because there is nothing in the
 * signed material that changes with time. So replay protection has to come
 * from the handler being idempotent instead: the same booking arriving twice
 * must produce the same row, not a second one. See the route.
 */
export function verifyCalWebhook(
  rawBody: string,
  headers: Headers,
  secret: string,
): { ok: true } | { ok: false; reason: string } {
  const signature = headers.get("x-cal-signature-256");
  if (!signature) return { ok: false, reason: "missing signature header" };

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  const a = Buffer.from(signature.trim().toLowerCase());
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature does not match" };
  }
  return { ok: true };
}

/**
 * The slice of Cal.com's payload we actually use.
 *
 * Cal.com sends a great deal more. Pinning the handful of fields we depend on
 * means a change to the rest of their schema is not our outage — and it keeps
 * an attendee's full record out of our logs.
 */
export type CalBooking = {
  trigger: "BOOKING_CREATED" | "BOOKING_RESCHEDULED" | "BOOKING_CANCELLED";
  bookingId: string;
  startTime: string;
  attendeeEmail: string | null;
  attendeeName: string | null;
  attendeeTimezone: string | null;
};

const HANDLED = new Set([
  "BOOKING_CREATED",
  "BOOKING_RESCHEDULED",
  "BOOKING_CANCELLED",
]);

export function parseCalBooking(rawBody: string): CalBooking | null {
  try {
    const body = JSON.parse(rawBody) as {
      triggerEvent?: string;
      payload?: {
        uid?: string;
        bookingId?: number | string;
        startTime?: string;
        attendees?: Array<{
          email?: string;
          name?: string;
          timeZone?: string;
        }>;
      };
    };

    const trigger = body.triggerEvent;
    if (!trigger || !HANDLED.has(trigger)) return null;

    const p = body.payload;
    if (!p?.startTime) return null;

    // `uid` is the stable public reference and survives a reschedule; the
    // numeric id does not always come through. Prefer uid, fall back.
    const bookingId = p.uid ?? (p.bookingId != null ? String(p.bookingId) : null);
    if (!bookingId) return null;

    // The parent is the first attendee; the teacher is the organiser and is
    // not in this array.
    const first = p.attendees?.[0];

    return {
      trigger: trigger as CalBooking["trigger"],
      bookingId,
      startTime: p.startTime,
      attendeeEmail: first?.email?.trim().toLowerCase() ?? null,
      attendeeName: first?.name?.trim() ?? null,
      attendeeTimezone: first?.timeZone?.trim() ?? null,
    };
  } catch {
    return null;
  }
}
