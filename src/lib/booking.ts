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
