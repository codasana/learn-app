import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import {
  classSessionMaterials,
  classSessions,
  contentItems,
  syllabi,
  syllabusWeeks,
  syllabusWeekItems,
} from "@/db/schema";
import { requireTeacher } from "@/lib/session";

import { ensureClassSessions } from "../../../actions";
import { WeekEditor } from "./week-editor";

export const metadata: Metadata = { title: "Week" };

export default async function WeekPage({
  params,
}: {
  params: Promise<{ id: string; weekId: string }>;
}) {
  await requireTeacher();
  const { id, weekId } = await params;

  const week = await db.query.syllabusWeeks.findFirst({
    where: and(
      eq(syllabusWeeks.id, weekId),
      eq(syllabusWeeks.syllabusId, id),
    ),
  });
  if (!week) notFound();

  const syllabus = await db.query.syllabi.findFirst({
    where: eq(syllabi.id, id),
  });
  if (!syllabus) notFound();

  await ensureClassSessions(week.id);

  const sessions = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.syllabusWeekId, week.id))
    .orderBy(asc(classSessions.classNumber));

  const materials = await db
    .select({
      id: classSessionMaterials.id,
      classSessionId: classSessionMaterials.classSessionId,
      release: classSessionMaterials.release,
      audienceOverride: classSessionMaterials.audienceOverride,
      contentId: contentItems.id,
      title: contentItems.title,
      type: contentItems.type,
      audience: contentItems.audience,
      status: contentItems.status,
    })
    .from(classSessionMaterials)
    .innerJoin(
      contentItems,
      eq(contentItems.id, classSessionMaterials.contentItemId),
    )
    .innerJoin(
      classSessions,
      eq(classSessions.id, classSessionMaterials.classSessionId),
    )
    .where(eq(classSessions.syllabusWeekId, week.id))
    .orderBy(asc(classSessionMaterials.sortOrder));

  const practice = await db
    .select({
      id: syllabusWeekItems.id,
      contentId: contentItems.id,
      title: contentItems.title,
      type: contentItems.type,
      audience: contentItems.audience,
      status: contentItems.status,
    })
    .from(syllabusWeekItems)
    .innerJoin(
      contentItems,
      eq(contentItems.id, syllabusWeekItems.contentItemId),
    )
    .where(eq(syllabusWeekItems.syllabusWeekId, week.id))
    .orderBy(asc(syllabusWeekItems.sortOrder));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/teacher/syllabus/${id}`}
          className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          ← {syllabus.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Week {week.weekNumber}</h1>
      </div>

      <WeekEditor
        level={syllabus.level}
        week={{
          id: week.id,
          weekNumber: week.weekNumber,
          theme: week.theme,
          grammarFocus: week.grammarFocus ?? "",
        }}
        sessions={sessions.map((s) => ({
          id: s.id,
          classNumber: s.classNumber,
          title: s.title,
          planMd: s.planMd ?? "",
          materials: materials.filter((m) => m.classSessionId === s.id),
        }))}
        practice={practice}
      />
    </div>
  );
}
