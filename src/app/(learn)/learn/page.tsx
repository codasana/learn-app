import { and, eq, gte } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/db";
import { activityCompletions } from "@/db/schema";
import { avatarEmoji } from "@/lib/avatars";
import { requireLearner, unitPractice } from "@/lib/child-session";
import { CONTENT_TYPES, type ContentTypeKey } from "@/lib/content-types";
import { isoDate } from "@/lib/leitner";
import { unitName } from "@/lib/unit-label";
import { dueCount, wordsKnown } from "@/lib/word-practice";

export const metadata: Metadata = { title: "Today" };

/**
 * Today.
 *
 * One screen, one short list, and it ends. A child should be able to see the
 * whole of what is being asked of them without scrolling and without deciding
 * anything — the ten minutes are the promise, and a screen that looks like
 * more than ten minutes breaks it before they start.
 */
export default async function TodayPage() {
  const learner = await requireLearner();
  const today = isoDate(new Date());

  if (!learner.enrolment?.unitId) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-16 text-center">
        <p className="text-5xl" aria-hidden="true">
          {avatarEmoji(learner.avatar)}
        </p>
        <h1 className="mt-4 text-2xl font-bold">
          Hello, {learner.firstName}
        </h1>
        <p className="mt-3 text-[var(--ink-muted)]">
          Your teacher hasn&rsquo;t set your first lessons yet. There will be
          something here as soon as she does.
        </p>
      </main>
    );
  }

  const items = await unitPractice(learner.enrolment.unitId);
  const vocabItems = items
    .filter((i) => i.type === "vocab_set")
    .map((i) => ({ id: i.id, body: i.body }));

  const [due, known, doneToday] = await Promise.all([
    dueCount(learner.childId, vocabItems, today),
    wordsKnown(learner.childId),
    db
      .select({ contentItemId: activityCompletions.contentItemId })
      .from(activityCompletions)
      .where(
        and(
          eq(activityCompletions.childId, learner.childId),
          gte(activityCompletions.completedAt, new Date(`${today}T00:00:00`)),
        ),
      ),
  ]);

  const activities = items.filter((i) => i.type !== "vocab_set");
  const completed = new Set(doneToday.map((d) => d.contentItemId));
  const wordsDone = due === 0;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
      <header className="flex items-center gap-3">
        <span className="text-4xl" aria-hidden="true">
          {avatarEmoji(learner.avatar)}
        </span>
        <div>
          <h1 className="text-2xl font-bold">Hello, {learner.firstName}</h1>
          <p className="text-[var(--ink-muted)]">
            {learner.enrolment.theme
              ? learner.enrolment.theme
              : unitName(learner.enrolment.label, learner.enrolment.currentUnit)}
          </p>
        </div>
      </header>

      <section className="mt-8 space-y-3">
        {vocabItems.length > 0 && (
          <Link
            href="/learn/words"
            className={`block rounded-[var(--radius-card)] px-5 py-5 transition-colors ${
              wordsDone
                ? "bg-[var(--correct-soft)]"
                : "bg-[var(--panel-lilac)] hover:brightness-[0.98]"
            }`}
          >
            <p className="text-lg font-bold">
              {wordsDone ? "Words — all done today" : "Practise your words"}
            </p>
            <p className="mt-1 text-[var(--ink-muted)]">
              {wordsDone
                ? "Come back tomorrow for the next ones."
                : `${due} ${due === 1 ? "word" : "words"} to look at`}
            </p>
          </Link>
        )}

        {activities.map((item) => {
          const done = completed.has(item.id);
          return (
            <Link
              key={item.id}
              href={`/learn/do/${item.id}`}
              className={`block rounded-[var(--radius-card)] px-5 py-5 transition-colors ${
                done
                  ? "bg-[var(--correct-soft)]"
                  : "bg-[var(--surface)] hover:bg-[var(--surface-sunken)]"
              }`}
            >
              <p className="text-lg font-bold">{item.title}</p>
              <p className="mt-1 text-[var(--ink-muted)]">
                {done
                  ? "Done — have another go if you like"
                  : (CONTENT_TYPES[item.type as ContentTypeKey]?.label ??
                    item.type)}
              </p>
            </Link>
          );
        })}
      </section>

      {known > 0 && (
        <p className="mt-10 text-center text-[var(--ink-muted)]">
          You know <strong className="text-[var(--ink)]">{known}</strong>{" "}
          {known === 1 ? "word" : "words"} so far.
        </p>
      )}

      {learner.viewedByParent && (
        <p className="mt-10 rounded-[var(--radius)] bg-[var(--surface-sunken)] px-4 py-3 text-center text-sm text-[var(--ink-muted)]">
          You&rsquo;re looking at {learner.firstName}&rsquo;s practice.
        </p>
      )}
    </main>
  );
}
