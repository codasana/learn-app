import "server-only";

/**
 * Loops — the marketing side of the funnel.
 *
 * Thin on purpose. This file knows how to talk to Loops and nothing about what
 * a lead means; src/lib/leads.ts owns that. The split matters because the
 * mapping from our funnel to Loops properties will change often and the HTTP
 * will not.
 *
 * Three rules hold everywhere in here:
 *
 *  1. **We push, we never pull.** `enquiries.status` is the source of truth
 *     for a lead's stage. Reading a stage back from Loops would give two
 *     systems ownership of one fact, and they would disagree exactly when it
 *     costs something.
 *
 *  2. **We never touch `subscribed`.** Loops owns unsubscribe state. Sending
 *     `subscribed: true` on an update silently resurrects someone who opted
 *     out — which is both a legal problem and the rudest possible bug.
 *
 *  3. **Failures are reported, never thrown at the caller's feet.** A lead is
 *     ours the moment its row is written. Losing the mirror is recoverable;
 *     losing the lead is not.
 */

const BASE = "https://app.loops.so/api/v1";

export function loopsReady(): boolean {
  return Boolean(process.env.LOOPS_API_KEY);
}

export type LoopsResult =
  | { ok: true; skipped?: true }
  | { ok: false; error: string };

async function call(
  path: string,
  init: { method: string; body?: unknown },
): Promise<LoopsResult> {
  const key = process.env.LOOPS_API_KEY;
  if (!key) return { ok: true, skipped: true };

  try {
    const res = await fetch(`${BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      // A marketing sync must never hold a parent's form submission open.
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `${res.status} ${detail.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Create the contact, or update it if Loops already has the address.
 *
 * `contacts/update` upserts, which is what makes this safe to call on every
 * stage change and on every re-run of the reconcile script. A create-then-
 * update pair would need its own "does it exist" round trip and would race
 * with itself the first time two tabs submitted at once.
 */
export function upsertContact(
  email: string,
  properties: Record<string, string | number | boolean | null>,
): Promise<LoopsResult> {
  return call("/contacts/update", {
    method: "PUT",
    // Note what is absent: `subscribed`. See rule 2 above.
    body: { email: email.toLowerCase(), ...properties },
  });
}

/**
 * A moment worth reacting to, as opposed to a state worth filtering on.
 *
 * Both are needed. The property is what a segment reads ("everyone still at
 * enquired"), so it decides who KEEPS getting a sequence. The event is what
 * starts one at the right second — a "class booked" mail that arrives on the
 * next segment refresh instead of immediately is a worse email.
 */
export function sendEvent(
  email: string,
  eventName: string,
  properties?: Record<string, string | number | boolean>,
): Promise<LoopsResult> {
  return call("/events/send", {
    method: "POST",
    body: { email: email.toLowerCase(), eventName, eventProperties: properties },
  });
}

/**
 * Used by the purge job. Declined leads are deleted from our database after
 * twelve months, and a deletion that leaves the contact sitting in Loops is
 * not a deletion — it is just a deletion we can no longer see.
 */
export function deleteContact(email: string): Promise<LoopsResult> {
  return call("/contacts/delete", {
    method: "POST",
    body: { email: email.toLowerCase() },
  });
}

/** Cheap credential check, for scripts and setup. */
export async function testKey(): Promise<LoopsResult> {
  return call("/api-key", { method: "GET" });
}
