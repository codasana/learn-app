import "server-only";

/**
 * A small fixed-window limiter, held in memory.
 *
 * Its one job today is rule 5 of the tool-link rules: nobody gets to sit there
 * trying tokens. A token is 32 random bytes, so guessing one is not a realistic
 * threat — but an unlimited lookup endpoint is still a free amplifier, and the
 * cost of closing it is this file.
 *
 * In memory is honest for a single instance. If this ever runs on more than
 * one, move it to Postgres or Upstash — the shape of the call site will not
 * change. It is deliberately NOT used for anything where being wrong matters,
 * like login: Better Auth has its own limiter for that.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Stops the map growing without bound on a long-lived server. */
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now };
  }
  return { ok: true, retryAfterMs: 0 };
}

/**
 * Best-effort client address. Behind a proxy the left-most entry of
 * `x-forwarded-for` is the client; it is spoofable, which is fine here — this
 * limits accidents and casual abuse, and nothing security-critical rests on it.
 */
export function clientKey(headers: Headers, prefix: string): string {
  const fwd = headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
  return `${prefix}:${ip}`;
}
