import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { enquiries } from "@/db/schema";
import {
  parseFormSubmitted,
  verifyWebhook,
} from "@/lib/automette-webhooks";

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

  const str = (key: string): string | null => {
    const v = answers[key];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  const ageBand = str("child_age_band");

  await db.insert(enquiries).values({
    parentName: str("parent_name"),
    parentEmail: str("parent_email")?.toLowerCase() ?? null,
    whatsapp: str("whatsapp"),
    childFirstName: str("child_first_name"),
    childAgeBand:
      ageBand === "8_9" || ageBand === "10_11" ? ageBand : null,
    childGrade: Number.isFinite(Number(str("child_grade")))
      ? Number(str("child_grade"))
      : null,
    timezone: str("timezone") ?? "Asia/Kolkata",
    source: "demo_form",
    notes: str("message"),
    autometteSubmissionId: submission_id,
  });

  return NextResponse.json({ ok: true });
}
