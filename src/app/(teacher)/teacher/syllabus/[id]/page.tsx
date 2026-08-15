import { asc, count, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import {
  classSessionMaterials,
  classSessions,
  syllabi,
  syllabusUnits,
  syllabusUnitItems,
} from "@/db/schema";
import { requireTeacher } from "@/lib/session";
import { unitCount } from "@/lib/unit-label";

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

  const units = await db
    .select()
    .from(syllabusUnits)
    .where(eq(syllabusUnits.syllabusId, id))
    .orderBy(asc(syllabusUnits.position));

  const unitIds = units.map((w) => w.id);

  // Two grouped counts rather than a count per unit — the board is one page and
  // should stay one page's worth of queries however long the term gets.
  const selfStudy = unitIds.length
    ? await db
        .select({ unitId: syllabusUnitItems.syllabusUnitId, n: count() })
        .from(syllabusUnitItems)
        .where(inArray(syllabusUnitItems.syllabusUnitId, unitIds))
        .groupBy(syllabusUnitItems.syllabusUnitId)
    : [];

  const classMaterials = unitIds.length
    ? await db
        .select({ unitId: classSessions.syllabusUnitId, n: count() })
        .from(classSessionMaterials)
        .innerJoin(
          classSessions,
          eq(classSessions.id, classSessionMaterials.classSessionId),
        )
        .where(inArray(classSessions.syllabusUnitId, unitIds))
        .groupBy(classSessions.syllabusUnitId)
    : [];

  const countFor = (rows: { unitId: string; n: number }[], unitId: string) =>
    rows.find((r) => r.unitId === unitId)?.n ?? 0;

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
          {unitCount(syllabus, units.length)} ·{" "}
          {syllabus.status === "published" ? "Published" : "Draft"}
        </p>
      </div>

      <Board
        syllabusId={syllabus.id}
        status={syllabus.status}
        label={{
          unitLabel: syllabus.unitLabel,
          unitLabelPlural: syllabus.unitLabelPlural,
        }}
        units={units.map((w) => ({
          id: w.id,
          position: w.position,
          theme: w.theme,
          grammarFocus: w.grammarFocus,
          selfStudy: countFor(selfStudy, w.id),
          classMaterials: countFor(classMaterials, w.id),
        }))}
      />
    </div>
  );
}
