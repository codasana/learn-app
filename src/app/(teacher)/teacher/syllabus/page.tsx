import { asc, count, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/db";
import { syllabi, syllabusWeeks } from "@/db/schema";
import { LEVEL_NAMES } from "@/lib/content-types";
import { requireTeacher } from "@/lib/session";

import { NewSyllabus } from "./new-syllabus";

export const metadata: Metadata = { title: "Syllabus" };

export default async function SyllabusListPage() {
  await requireTeacher();

  const rows = await db
    .select({
      id: syllabi.id,
      name: syllabi.name,
      level: syllabi.level,
      status: syllabi.status,
      weeks: count(syllabusWeeks.id),
    })
    .from(syllabi)
    .leftJoin(syllabusWeeks, eq(syllabusWeeks.syllabusId, syllabi.id))
    .groupBy(syllabi.id)
    .orderBy(asc(syllabi.level), desc(syllabi.createdAt));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Syllabus</h1>
        <p className="max-w-2xl text-[var(--ink-muted)]">
          A syllabus is the order you teach things in. It points at pieces from
          your content library — nothing is copied, so editing a passage updates
          it everywhere it appears, and moving a week takes everything inside it
          along.
        </p>
      </div>

      {rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((s) => (
            <li key={s.id}>
              <Link
                href={`/teacher/syllabus/${s.id}`}
                className="flex items-center gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition-colors hover:border-[var(--border-strong)]"
              >
                <div className="flex-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-[var(--ink-muted)]">
                    {LEVEL_NAMES[s.level] ?? `Level ${s.level}`} · {s.weeks} week
                    {s.weeks === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-sm text-[var(--ink-faint)]">
                  {s.status === "published" ? "Published" : "Draft"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewSyllabus hasAny={rows.length > 0} />
    </div>
  );
}
