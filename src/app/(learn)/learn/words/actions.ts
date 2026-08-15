"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { dailyProgress } from "@/db/schema";
import { requireLearner } from "@/lib/child-session";
import { isoDate } from "@/lib/leitner";
import { recordAnswer } from "@/lib/word-practice";

/**
 * One answer.
 *
 * The child sends the word and whether they got it right; the schedule is
 * computed on the server. A device never gets to say when a word comes back,
 * and the learner is resolved from the session rather than from an argument,
 * so no request can write into another child's memory.
 */
export async function answer(key: string, wasCorrect: boolean) {
  const learner = await requireLearner();
  await recordAnswer(learner.childId, key, wasCorrect);
  return { ok: true as const };
}

/** Marks the daily habit done. Used by the streak and the parent's view. */
export async function finishWords() {
  const learner = await requireLearner();
  const today = isoDate(new Date());

  const existing = await db.query.dailyProgress.findFirst({
    where: and(
      eq(dailyProgress.childId, learner.childId),
      eq(dailyProgress.date, today),
    ),
  });

  if (existing) {
    await db
      .update(dailyProgress)
      .set({ vocabDone: true })
      .where(eq(dailyProgress.id, existing.id));
  } else {
    await db
      .insert(dailyProgress)
      .values({ childId: learner.childId, date: today, vocabDone: true })
      .onConflictDoNothing();
  }

  return { ok: true as const };
}
