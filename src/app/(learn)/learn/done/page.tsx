import { and, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/db";
import {
  activityCompletions,
  contentItems,
  syllabusUnits,
  syllabusUnitItems,
  writingSubmissions,
} from "@/db/schema";
import { requireLearner } from "@/lib/child-session";
import { CONTENT_TYPES, type ContentTypeKey } from "@/lib/content-types";
import { unitName } from "@/lib/unit-label";

export const metadata: Metadata = { title: "What you've done" };

/**
 * The shelf.
 *
 * Only what is finished, and only backwards. There is deliberately no view of
 * what is coming: the syllabus is the teacher's plan and she reorders it, so
 * showing a child unit five makes a promise nobody made — and class materials
 * carry release rules that a forward view would leak.
 *
 * Grouped by unit, because that is how a child remembers it ("the one about
 * families"), with the theme as the heading and the position as the fallback.
 * Everything here is re-openable: re-reading a passage is good for fluency and
 * re-doing a quiz costs nothing.
 */
export default async function DonePage() {
  const learner = await requireLearner();

  if (!learner.enrolment) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">Nothing yet</h1>
        <p className="mt-3 text-[var(--ink-muted)]">
          Once you start, everything you finish will be kept here.
        </p>
      </main>
    );
  }

  const { syllabusId, currentUnit, label } = learner.enrolment;

  // Units up to and including the one they are on. Never beyond.
  const units = await db
    .select({
      id: syllabusUnits.id,
      position: syllabusUnits.position,
      theme: syllabusUnits.theme,
    })
    .from(syllabusUnits)
    .where(eq(syllabusUnits.syllabusId, syllabusId))
    .orderBy(desc(syllabusUnits.position));

  const past = units.filter((u) => u.position <= currentUnit);

  const [done, writing] = await Promise.all([
    db
      .select({
        contentItemId: activityCompletions.contentItemId,
        score: activityCompletions.score,
        total: activityCompletions.total,
        completedAt: activityCompletions.completedAt,
      })
      .from(activityCompletions)
      .where(eq(activityCompletions.childId, learner.childId))
      .orderBy(desc(activityCompletions.completedAt)),
    db
      .select({
        id: writingSubmissions.id,
        taskId: writingSubmissions.writingTaskId,
        status: writingSubmissions.status,
        title: contentItems.title,
      })
      .from(writingSubmissions)
      .innerJoin(
        contentItems,
        eq(contentItems.id, writingSubmissions.writingTaskId),
      )
      .where(eq(writingSubmissions.childId, learner.childId)),
  ]);

  const items = await db
    .select({
      unitId: syllabusUnitItems.syllabusUnitId,
      id: contentItems.id,
      title: contentItems.title,
      type: contentItems.type,
    })
    .from(syllabusUnitItems)
    .innerJoin(
      contentItems,
      eq(contentItems.id, syllabusUnitItems.contentItemId),
    )
    .where(
      and(
        eq(contentItems.audience, "student"),
        eq(contentItems.status, "published"),
      ),
    );

  const bestScore = new Map<string, { score: number | null; total: number | null }>();
  for (const d of done) {
    if (d.contentItemId && !bestScore.has(d.contentItemId)) {
      bestScore.set(d.contentItemId, { score: d.score, total: d.total });
    }
  }

  const anything = bestScore.size > 0 || writing.length > 0;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 pt-4 pb-10">
      <h1 className="text-2xl font-bold">What you&rsquo;ve done</h1>

      {!anything ? (
        <p className="mt-4 text-[var(--ink-muted)]">
          Nothing finished yet. Everything you complete gets kept here so you
          can go back to it.
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {past.map((unit) => {
            const unitItems = items.filter((i) => i.unitId === unit.id);
            const finished = unitItems.filter((i) => bestScore.has(i.id));
            const unitWriting = writing.filter((w) =>
              unitItems.some((i) => i.id === w.taskId),
            );

            if (finished.length === 0 && unitWriting.length === 0) return null;

            return (
              <section key={unit.id}>
                <h2 className="text-sm font-medium tracking-wide text-[var(--ink-faint)] uppercase">
                  {unit.theme || unitName(label, unit.position)}
                </h2>

                <ul className="mt-3 space-y-2">
                  {finished.map((item) => {
                    const s = bestScore.get(item.id)!;
                    return (
                      <li key={item.id}>
                        <Link
                          href={`/learn/do/${item.id}`}
                          className="block rounded-[var(--radius-card)] bg-[var(--surface)] px-5 py-4 hover:bg-[var(--surface-sunken)]"
                        >
                          <p className="font-bold">{item.title}</p>
                          <p className="mt-1 text-[var(--ink-muted)]">
                            {CONTENT_TYPES[item.type as ContentTypeKey]?.label ??
                              item.type}
                            {s.total ? ` · ${s.score} out of ${s.total}` : ""}
                          </p>
                        </Link>
                      </li>
                    );
                  })}

                  {unitWriting.map((w) => (
                    <li key={w.id}>
                      <Link
                        href={`/learn/do/${w.taskId}`}
                        className="block rounded-[var(--radius-card)] bg-[var(--panel-peach)] px-5 py-4"
                      >
                        <p className="font-bold">{w.title}</p>
                        <p className="mt-1 text-[var(--ink-muted)]">
                          {w.status === "released" || w.status === "redrafted"
                            ? "Your teacher has written back"
                            : "Waiting for your teacher"}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <div className="mt-10">
        <Link
          href="/learn"
          className="inline-flex min-h-[var(--tap-target)] items-center gap-2 rounded-[var(--radius)] px-3 text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
        >
          <span aria-hidden="true">←</span>
          Today
        </Link>
      </div>
    </main>
  );
}
