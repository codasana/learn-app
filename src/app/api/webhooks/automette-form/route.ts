import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { enquiries } from "@/db/schema";
import {
  parseFormSubmitted,
  verifyWebhook,
} from "@/lib/automette-webhooks";
import { upsertEnquiry } from "@/lib/enquiries";
import { syncLeadById } from "@/lib/leads";

import { readAnswers } from "./read-answers";

/**
 * Where "Book a free session" arrives from Automette.
 *
 * Unauthenticated by design — the signature is the authentication. Anything
 * that fails verification is refused before a single byte is trusted, and the
 * refusal says as little as possible.
 *
 * The reply is deliberately 200 for anything we have decided not to act on
 * (a duplicate, an event type we do not handle). A non-2xx tells Automette to
 * retry, and retrying a delivery we understood perfectly well and chose to
 * ignore just fills its queue. 4xx is reserved for "this was not from you",
 * 5xx for "we broke, please do try again".
 */
export async function POST(req: Request) {
  const secret = process.env.AUTOMETTE_FORM_SECRET;
  if (!secret) {
    // Not configured yet. Refuse rather than accept unverified data.
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  // The raw body, before any parsing. Re-serialising would change the bytes
  // and break the signature.
  const raw = await req.text();

  const verified = verifyWebhook(raw, req.headers, secret);
  if (!verified.ok) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = parseFormSubmitted(raw);
  if (!event) {
    // Understood, not ours to act on. Do not make it retry.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const { submission_id, answers } = event;

  // Idempotent on the submission id. Automette retries with a stable
  // `webhook-id`, so the same enquiry will legitimately arrive twice and must
  // not become two families.
  const existing = await db.query.enquiries.findFirst({
    where: eq(enquiries.autometteSubmissionId, submission_id),
  });
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const a = readAnswers(answers);

  if (!a.parentEmail) {
    // Without an address there is nothing to identify them by and no way to
    // reply. Understood, deliberately not acted on — a retry cannot help.
    return NextResponse.json({ ok: true, ignored: "no email" });
  }

  /*
   * Merged on email, not inserted blind. This same family may already have a
   * row from taking the free check, and two rows for one child is the bug
   * that follows them all the way to Loops. See src/lib/enquiries.ts.
   */
  const { id, merged } = await upsertEnquiry({
    parentName: a.parentName,
    parentEmail: a.parentEmail,
    whatsapp: a.whatsapp,
    childFirstName: a.childFirstName,
    childAgeBand: a.childAgeBand,
    childGrade: a.childGrade,
    timezone: a.timezone,
    source: "demo_form",
    notes: a.message,
    autometteSubmissionId: submission_id,
  });

  /*
   * After the insert, and unable to fail it.
   *
   * Automette retries on a non-2xx, but the retry would hit the duplicate
   * check above and return early — so a 500 raised by a Loops outage would
   * lose this lead's mirror for good rather than earning a second attempt.
   * syncLeadById never throws, and scripts/sync-loops.ts is the real retry.
   */
  await syncLeadById(id);

  return NextResponse.json({ ok: true, merged });
}
