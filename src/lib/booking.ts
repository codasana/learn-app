/**
 * Where a parent books the free session, and where our own links point.
 *
 * Booking is Cal.com and stays Cal.com: it handles a Gulf family picking an
 * evening slot in Indian time without us writing a line of timezone code, and
 * that is the entire painful part. See docs V2/01 — "nothing built".
 *
 * The URL is configuration rather than a constant because it is not ours: it
 * belongs to Sheeba's Cal.com account and will change if she renames the event
 * type or moves provider. Everything that offers a booking reads it from here.
 */
export function bookingUrl(): string | null {
  const raw = process.env.CAL_BOOKING_URL?.trim();
  if (!raw) return null;
  // A misconfigured value must not become a broken link in a parent's inbox.
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * A booking link that knows who is clicking it.
 *
 * Matching a Cal.com booking back to an enquiry by attendee email is a guess:
 * a parent who books with a different address than they gave us silently
 * becomes an unmatched booking, and nobody finds out until Sheeba wonders why
 * the enquiry still says "new".
 *
 * So the id travels in the link. Cal.com prefills a booking question from a
 * query parameter of the same name, and returns the answer in the webhook —
 * which turns the match from a guess into a lookup. Name and email are
 * prefilled too, because a parent who has just typed them should not type
 * them again, and every field we fill is one fewer chance to enter a
 * different address.
 *
 * Requires a short-text question with identifier `enquiryId` on the Cal.com
 * event type, hidden. Without it the parameter is ignored, the link still
 * works, and the webhook falls back to matching on email.
 */
export function bookingUrlFor(opts: {
  enquiryId?: string | null;
  name?: string | null;
  email?: string | null;
}): string | null {
  const base = bookingUrl();
  if (!base) return null;

  const url = new URL(base);
  if (opts.enquiryId) url.searchParams.set("enquiryId", opts.enquiryId);
  if (opts.name) url.searchParams.set("name", opts.name);
  if (opts.email) url.searchParams.set("email", opts.email);
  return url.toString();
}

/**
 * Our own origin, for links inside emails.
 *
 * An email is read outside the request that made it, so a relative path is
 * useless — every link has to be absolute. Vercel names the production
 * hostname in the environment; nothing here is guessed.
 */
export function appUrl(path = "/"): string {
  const host =
    process.env.APP_ORIGIN ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return new URL(path, host.replace(/\/+$/, "") + "/").toString();
}
