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
  syllabusUnits,
  syllabusUnitItems,
} from "@/db/schema";
import { requireTeacher } from "@/lib/session";
import { unitName } from "@/lib/unit-label";

import { allTags } from "../../../../content/actions";
import { ensureClassSessions } from "../../../actions";
import { UnitEditor } from "./unit-editor";

export const metadata: Metadata = { title: "Unit" };

export default async function WeekPage({
  params,
}: {
  params: Promise<{ id: string; unitId: string }>;
}) {
  await requireTeacher();
  const { id, unitId } = await params;

  const unit = await db.query.syllabusUnits.findFirst({
    where: and(
      eq(syllabusUnits.id, unitId),
      eq(syllabusUnits.syllabusId, id),
    ),
  });
  if (!unit) notFound();

  const syllabus = await db.query.syllabi.findFirst({
    where: eq(syllabi.id, id),
  });
  if (!syllabus) notFound();

  await ensureClassSessions(unit.id);

  const sessions = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.syllabusUnitId, unit.id))
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
    .where(eq(classSessions.syllabusUnitId, unit.id))
    .orderBy(asc(classSessionMaterials.sortOrder));

  const practice = await db
    .select({
      id: syllabusUnitItems.id,
      contentId: contentItems.id,
      title: contentItems.title,
      type: contentItems.type,
      audience: contentItems.audience,
      status: contentItems.status,
    })
    .from(syllabusUnitItems)
    .innerJoin(
      contentItems,
      eq(contentItems.id, syllabusUnitItems.contentItemId),
    )
    .where(eq(syllabusUnitItems.syllabusUnitId, unit.id))
    .orderBy(asc(syllabusUnitItems.sortOrder));

  const tags = await allTags();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/teacher/syllabus/${id}`}
          className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          ← {syllabus.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {unitName(syllabus, unit.position)}
        </h1>
      </div>

      <UnitEditor
        tags={tags.map((t) => t.tag)}
        unit={{
          id: unit.id,
          position: unit.position,
          theme: unit.theme,
          grammarFocus: unit.grammarFocus ?? "",
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
