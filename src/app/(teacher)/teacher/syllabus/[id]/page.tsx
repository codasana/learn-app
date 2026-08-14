import { asc, count, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import {
  classSessionMaterials,
  classSessions,
  syllabi,
  syllabusWeeks,
  syllabusWeekItems,
} from "@/db/schema";
import { requireTeacher } from "@/lib/session";

import { Board } from "./board";

export const metadata: Metadata = { title: "Syllabus" };

export default async function SyllabusBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();
  const { id } = await params;

  const syllabus = await db.query.syllabi.findFirst({
    where: eq(syllabi.id, id),
  });
  if (!syllabus) notFound();

  const weeks = await db
    .select()
    .from(syllabusWeeks)
    .where(eq(syllabusWeeks.syllabusId, id))
    .orderBy(asc(syllabusWeeks.weekNumber));

  const weekIds = weeks.map((w) => w.id);

  // Two grouped counts rather than a count per week — the board is one page and
  // should stay one page's worth of queries however long the term gets.
  const selfStudy = weekIds.length
    ? await db
        .select({ weekId: syllabusWeekItems.syllabusWeekId, n: count() })
        .from(syllabusWeekItems)
        .where(inArray(syllabusWeekItems.syllabusWeekId, weekIds))
        .groupBy(syllabusWeekItems.syllabusWeekId)
    : [];

  const classMaterials = weekIds.length
    ? await db
        .select({ weekId: classSessions.syllabusWeekId, n: count() })
        .from(classSessionMaterials)
        .innerJoin(
          classSessions,
          eq(classSessions.id, classSessionMaterials.classSessionId),
        )
        .where(inArray(classSessions.syllabusWeekId, weekIds))
        .groupBy(classSessions.syllabusWeekId)
    : [];

  const byWeek = (rows: { weekId: string; n: number }[], weekId: string) =>
    rows.find((r) => r.weekId === weekId)?.n ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/teacher/syllabus"
          className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          ← All syllabuses
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{syllabus.name}</h1>
        <p className="text-[var(--ink-muted)]">
          {weeks.length} week{weeks.length === 1 ? "" : "s"} ·{" "}
          {syllabus.status === "published" ? "Published" : "Draft"}
        </p>
      </div>

      <Board
        syllabusId={syllabus.id}
        status={syllabus.status}
        weeks={weeks.map((w) => ({
          id: w.id,
          weekNumber: w.weekNumber,
          theme: w.theme,
          grammarFocus: w.grammarFocus,
          selfStudy: byWeek(selfStudy, w.id),
          classMaterials: byWeek(classMaterials, w.id),
        }))}
      />
    </div>
  );
}
