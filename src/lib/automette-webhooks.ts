import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifying a webhook from Automette.
 *
 * The scheme is Standard Webhooks. Automette's reference page documents it
 * correctly; its forms guide says `X-Signature`, which is wrong and came from
 * our own feature request. Written against the reference and the
 * implementation, which agree.
 *
 *   signed payload = `${webhook-id}.${webhook-timestamp}.${raw body}`
 *   secret         = the part after "wh_", base64url-decoded
 *   header value   = "v1,<base64 hmac-sha256>"
 *
 * Two things this must get right, because both are how signature checks are
 * usually got wrong:
 *
 *  - **The raw body, byte for byte.** Parsing to JSON and re-stringifying
 *    changes key order and whitespace and the signature stops matching.
 *  - **A timestamp window.** Without one, anybody who ever captures a valid
 *    delivery can replay it forever.
 */

/** Deliveries older than this are refused. Generous enough for a slow retry. */
const TOLERANCE_SECONDS = 5 * 60;

export type VerifyResult =
  | { ok: true; eventId: string }
  | { ok: false; reason: string };

export function verifyWebhook(
  rawBody: string,
  headers: Headers,
  secret: string,
  now = Date.now(),
): VerifyResult {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");

  if (!id || !timestamp || !signature) {
    return { ok: false, reason: "missing signature headers" };
  }

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) {
    return { ok: false, reason: "bad timestamp" };
  }
  const ageSeconds = Math.abs(Math.floor(now / 1000) - sent);
  if (ageSeconds > TOLERANCE_SECONDS) {
    return { ok: false, reason: "timestamp outside the accepted window" };
  }

  const raw = secret.startsWith("wh_") ? secret.slice(3) : secret;
  const expected = createHmac("sha256", Buffer.from(raw, "base64url"))
    .update(`${id}.${sent}.${rawBody}`)
    .digest("base64");

  // The header may carry several space-separated versions; any match passes.
  const candidates = signature
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith("v1,") ? s.slice(3) : s));

  const matched = candidates.some((candidate) => {
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });

  if (!matched) return { ok: false, reason: "signature does not match" };

  return { ok: true, eventId: id };
}

/**
 * What Automette sends for a form submission.
 *
 * The body is FLAT — `event_id` and `event` sit alongside the submission
 * fields rather than wrapping them in a `data` object. Worth stating plainly
 * because the natural assumption is the other way round, and a parser reaching
 * for `data.submission_id` fails silently by treating every delivery as
 * unrecognised.
 */
export type FormSubmittedEvent = {
  event_id: string;
  event: "form.submitted";
  form_id: string;
  submission_id: string;
  answers: Record<string, unknown>;
  submitted_at: string;
};

export function parseFormSubmitted(
  rawBody: string,
): FormSubmittedEvent | null {
  try {
    const parsed = JSON.parse(rawBody) as Partial<FormSubmittedEvent>;
    if (parsed?.event !== "form.submitted") return null;
    if (typeof parsed.submission_id !== "string") return null;
    if (typeof parsed.answers !== "object" || parsed.answers === null) {
      return null;
    }
    return parsed as FormSubmittedEvent;
  } catch {
    return null;
  }
}
