import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/db";
import {
  activityCompletions,
  contentItems,
  syllabusUnits,
  syllabusUnitItems,
  submissions,
} from "@/db/schema";
import { requireLearner } from "@/lib/child-session";
import { CONTENT_TYPES, type ContentTypeKey } from "@/lib/content-types";
import { unitName } from "@/lib/unit-label";

export const metadata: Metadata = { title: "Your lessons" };

/**
 * The whole journey: what has been done, and a glimpse of what is coming.
 *
 * Behind is open — everything finished can be reopened, because re-reading is
 * good for fluency and re-doing a quiz costs nothing.
 *
 * Ahead is titles only, and nothing is clickable. That line is where the
 * design argument sits. Showing the full contents of a future unit would leak
 * class material carrying a release rule ("during class", "after class") and
 * would let a child read the passage the live lesson is built around. Showing
 * nothing at all, though, hides the shape of the thing from the parent paying
 * for it and from a child who wants to know where this is going. A theme
 * answers "what's next?" without spoiling anything.
 *
 * Units with no theme are left out rather than listed as blanks: an unwritten
 * unit is the teacher's business, not a gap on a child's screen.
 */
export default async function UnitsPage() {
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

  const units = await db
    .select({
      id: syllabusUnits.id,
      position: syllabusUnits.position,
      theme: syllabusUnits.theme,
    })
    .from(syllabusUnits)
    .where(eq(syllabusUnits.syllabusId, syllabusId))
    .orderBy(asc(syllabusUnits.position));

  const behind = units.filter((u) => u.position <= currentUnit).reverse();
  const ahead = units.filter((u) => u.position > currentUnit && u.theme.trim());

  const [done, writing, items] = await Promise.all([
    db
      .select({
        contentItemId: activityCompletions.contentItemId,
        score: activityCompletions.score,
        total: activityCompletions.total,
      })
      .from(activityCompletions)
      .where(eq(activityCompletions.childId, learner.childId)),
    db
      .select({
        id: submissions.id,
        taskId: submissions.contentItemId,
        status: submissions.status,
        title: contentItems.title,
      })
      .from(submissions)
      .innerJoin(contentItems, eq(contentItems.id, submissions.contentItemId))
      .where(eq(submissions.childId, learner.childId)),
    db
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
      ),
  ]);

  const best = new Map<string, { score: number | null; total: number | null }>();
  for (const d of done) {
    if (d.contentItemId && !best.has(d.contentItemId)) {
      best.set(d.contentItemId, { score: d.score, total: d.total });
    }
  }

  const anythingDone = best.size > 0 || writing.length > 0;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 pt-4 pb-10">
      <h1 className="text-2xl font-bold">
        Your {label.unitLabelPlural.toLowerCase()}
      </h1>

      {!anythingDone && ahead.length === 0 && (
        <p className="mt-4 text-[var(--ink-muted)]">
          Nothing finished yet. Everything you complete gets kept here so you
          can come back to it.
        </p>
      )}

      {/* ---- behind: everything finished, still open ---- */}
      <div className="mt-6 space-y-8">
        {behind.map((unit) => {
          const unitItems = items.filter((i) => i.unitId === unit.id);
          const finished = unitItems.filter((i) => best.has(i.id));
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
                  const s = best.get(item.id)!;
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

      {/* ---- ahead: themes only, nothing to open ---- */}
      {ahead.length > 0 && (
        <section className="mt-12">
          <h2 className="text-sm font-medium tracking-wide text-[var(--ink-faint)] uppercase">
            Coming up
          </h2>

          <ul className="mt-3 space-y-2">
            {ahead.map((unit) => (
              <li
                key={unit.id}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] px-5 py-4"
              >
                <span className="text-[var(--ink-faint)]" aria-hidden="true">
                  🔒
                </span>
                {/*
                  No number here on purpose. Units without a theme are skipped,
                  so numbering would read "3, 5" and leave a child wondering
                  what happened to four — and the teacher reorders units, which
                  would make any number shown now a small broken promise later.
                  The order is the promise; the position is not.
                */}
                <span className="font-bold text-[var(--ink-muted)]">
                  {unit.theme}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-sm text-[var(--ink-faint)]">
            These open when you get to them, and your teacher may change
            what&rsquo;s coming.
          </p>
        </section>
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
