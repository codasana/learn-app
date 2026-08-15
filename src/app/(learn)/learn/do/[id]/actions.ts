"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { activityCompletions, submissions } from "@/db/schema";
import { requireLearner, unitPractice } from "@/lib/child-session";
import { acceptedKinds, type SubmissionKind } from "@/lib/content-types";

/**
 * Everything here re-derives the child from the session and re-checks that the
 * item is in *their* current unit.
 *
 * A content id is a guessable-ish handle sitting in a URL. Without this check a
 * child could post a completion against any item in the library — including a
 * teacher-only answer key — and quietly appear to have done work nobody set
 * them. The check is cheap and it belongs on every write.
 */
async function requireItemInThisWeek(contentItemId: string) {
  const learner = await requireLearner();
  if (!learner.enrolment?.unitId) return null;

  const items = await unitPractice(learner.enrolment.unitId);
  const item = items.find((i) => i.id === contentItemId);
  if (!item) return null;

  return { learner, item };
}

const completion = z.object({
  kind: z.enum(["reading", "listening", "sentence_builder", "quiz"]),
  score: z.number().int().min(0),
  total: z.number().int().min(0),
});

export async function completeActivity(
  contentItemId: string,
  input: { kind: string; score: number; total: number },
): Promise<{ ok: boolean }> {
  const ctx = await requireItemInThisWeek(contentItemId);
  if (!ctx) return { ok: false };

  const parsed = completion.safeParse(input);
  if (!parsed.success) return { ok: false };

  await db.insert(activityCompletions).values({
    childId: ctx.learner.childId,
    kind: parsed.data.kind,
    contentItemId,
    score: parsed.data.score,
    total: parsed.data.total,
  });

  revalidatePath("/learn");
  return { ok: true };
}

/**
 * Hands something to the teacher.
 *
 * Nothing is scored and nothing is shown back. The child is told a person will
 * look at it, because a person will — no AI text ever reaches a child without
 * the teacher releasing it, which is why `ai_draft` is never selected here.
 *
 * One function for every shape of answer. The activity decides which shapes it
 * accepts; this checks the answer against that and stores it in the column
 * that fits. Adding a shape means adding it to `accepts`, not writing a second
 * submit action that drifts from this one.
 */
export async function submit(
  contentItemId: string,
  answer:
    | { kind: "text"; body: string }
    | { kind: "audio" | "photo" | "file"; mediaUrl: string; seconds?: number }
    | { kind: "answers"; payload: Record<string, unknown> },
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireItemInThisWeek(contentItemId);
  if (!ctx) return { ok: false, error: "That task isn't set for you." };

  const allowed = acceptedKinds(ctx.item.type);
  if (!allowed.includes(answer.kind)) {
    return { ok: false, error: "That isn't how this one is handed in." };
  }

  const values: {
    kind: SubmissionKind;
    body?: string | null;
    mediaUrl?: string | null;
    mediaSeconds?: number | null;
    payload?: Record<string, unknown>;
  } = { kind: answer.kind };

  if (answer.kind === "text") {
    const text = answer.body.trim();
    if (text.length < 5) {
      return { ok: false, error: "Write a little more before sending it." };
    }
    if (text.length > 20000) {
      return { ok: false, error: "That's longer than this box can take." };
    }
    values.body = text;
  } else if (answer.kind === "answers") {
    values.payload = answer.payload;
  } else {
    // The upload already happened; this is the key it landed under. Anything
    // else would let a child point their submission at an arbitrary URL.
    if (!/^[\w./-]+$/.test(answer.mediaUrl)) {
      return { ok: false, error: "That file didn't upload properly." };
    }
    values.mediaUrl = answer.mediaUrl;
    values.mediaSeconds = answer.seconds ?? null;
  }

  const existing = await db.query.submissions.findFirst({
    where: and(
      eq(submissions.childId, ctx.learner.childId),
      eq(submissions.contentItemId, contentItemId),
    ),
  });

  // Re-submitting before the teacher has looked replaces it rather than
  // stacking up copies. Once she has read it, a change is a redraft and that
  // is a different flow.
  if (existing && existing.status === "submitted") {
    await db
      .update(submissions)
      .set({ ...values, submittedAt: new Date() })
      .where(eq(submissions.id, existing.id));
  } else if (!existing) {
    await db.insert(submissions).values({
      childId: ctx.learner.childId,
      contentItemId,
      ...values,
    });
  }

  revalidatePath("/learn");
  return { ok: true };
}
