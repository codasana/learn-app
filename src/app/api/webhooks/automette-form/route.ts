import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { enquiries } from "@/db/schema";
import {
  parseFormSubmitted,
  verifyWebhook,
} from "@/lib/automette-webhooks";
import { syncLeadById } from "@/lib/leads";

import { readAnswers } from "./read-answers";

/**
 * Where "Book a free class" arrives from Automette.
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

  const [row] = await db
    .insert(enquiries)
    .values({
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
    })
    .returning({ id: enquiries.id });

  /*
   * After the insert, and unable to fail it.
   *
   * Automette retries on a non-2xx, but the retry would hit the duplicate
   * check above and return early — so a 500 raised by a Loops outage would
   * lose this lead's mirror for good rather than earning a second attempt.
   * syncLeadById never throws, and scripts/sync-loops.ts is the real retry.
   */
  await syncLeadById(row.id);

  return NextResponse.json({ ok: true });
}
