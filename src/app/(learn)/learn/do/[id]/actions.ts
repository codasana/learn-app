"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { activityCompletions, writingSubmissions } from "@/db/schema";
import { requireLearner, weekPractice } from "@/lib/child-session";

/**
 * Everything here re-derives the child from the session and re-checks that the
 * item is in *their* current week.
 *
 * A content id is a guessable-ish handle sitting in a URL. Without this check a
 * child could post a completion against any item in the library — including a
 * teacher-only answer key — and quietly appear to have done work nobody set
 * them. The check is cheap and it belongs on every write.
 */
async function requireItemInThisWeek(contentItemId: string) {
  const learner = await requireLearner();
  if (!learner.enrolment?.weekId) return null;

  const items = await weekPractice(learner.enrolment.weekId);
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
 * Hands a piece of writing to the teacher.
 *
 * Nothing is scored and nothing is shown back. The child is told a person will
 * read it, because a person will — no AI text ever reaches a child without the
 * teacher releasing it, which is why `ai_draft` is never selected here.
 */
export async function submitWriting(
  contentItemId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireItemInThisWeek(contentItemId);
  if (!ctx) return { ok: false, error: "That task isn't set for you." };

  const text = body.trim();
  if (text.length < 5) {
    return { ok: false, error: "Write a little more before sending it." };
  }
  if (text.length > 20000) {
    return { ok: false, error: "That's longer than this box can take." };
  }

  const existing = await db.query.writingSubmissions.findFirst({
    where: and(
      eq(writingSubmissions.childId, ctx.learner.childId),
      eq(writingSubmissions.writingTaskId, contentItemId),
    ),
  });

  // Re-submitting before the teacher has looked replaces the draft rather than
  // stacking up copies. Once she has read it, a change is a redraft and that
  // is a different flow.
  if (existing && existing.status === "submitted") {
    await db
      .update(writingSubmissions)
      .set({ body: text, submittedAt: new Date() })
      .where(eq(writingSubmissions.id, existing.id));
  } else if (!existing) {
    await db.insert(writingSubmissions).values({
      childId: ctx.learner.childId,
      writingTaskId: contentItemId,
      body: text,
    });
  }

  revalidatePath("/learn");
  return { ok: true };
}
