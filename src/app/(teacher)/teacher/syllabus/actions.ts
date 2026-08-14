"use server";

import { and, asc, desc, eq, ilike, type SQL, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  classSessionMaterials,
  classSessions,
  contentItems,
  syllabi,
  syllabusWeeks,
  syllabusWeekItems,
} from "@/db/schema";
import { CONTENT_TYPE_KEYS } from "@/lib/content-types";
import { requireTeacher } from "@/lib/session";
import {
  deleteWeekAndClose,
  findWeek,
  reorderList,
  swapWeekWithNeighbour,
} from "@/lib/syllabus-order";

export type Result = { ok: true } | { ok: false; error: string };

/** Every syllabus page revalidates the same two paths. */
function touch(syllabusId: string) {
  revalidatePath("/teacher/syllabus");
  revalidatePath(`/teacher/syllabus/${syllabusId}`, "layout");
}

/* ------------------------------------------------------------------ */
/* The syllabus itself                                                 */
/* ------------------------------------------------------------------ */

const newSyllabus = z.object({
  name: z.string().trim().min(1, "Give it a name."),
  level: z.coerce.number().int().min(1).max(4),
  weeks: z.coerce.number().int().min(1).max(52),
});

/**
 * Creates the syllabus and its empty weeks in one go. A term is a known length,
 * and starting from twelve blank weeks is far less work than adding them one at
 * a time — weeks can still be added or removed afterwards.
 */
export async function createSyllabus(
  formData: FormData,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const teacher = await requireTeacher();

  const parsed = newSyllabus.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(syllabi)
      .values({ name: v.name, level: v.level, createdBy: teacher.id })
      .returning({ id: syllabi.id });

    await tx.insert(syllabusWeeks).values(
      Array.from({ length: v.weeks }, (_, i) => ({
        syllabusId: row.id,
        weekNumber: i + 1,
        theme: "",
      })),
    );

    return row.id;
  });

  revalidatePath("/teacher/syllabus");
  return { ok: true, id };
}

export async function renameSyllabus(
  id: string,
  name: string,
): Promise<Result> {
  await requireTeacher();
  if (!name.trim()) return { ok: false, error: "Give it a name." };
  await db.update(syllabi).set({ name: name.trim() }).where(eq(syllabi.id, id));
  touch(id);
  return { ok: true };
}

export async function setSyllabusStatus(
  id: string,
  status: "draft" | "published",
) {
  await requireTeacher();
  await db.update(syllabi).set({ status }).where(eq(syllabi.id, id));
  touch(id);
}

export async function deleteSyllabus(id: string) {
  await requireTeacher();
  // Weeks, classes and material rows cascade. Enrollments reference the
  // syllabus with `restrict`, so this fails loudly if a child is on it —
  // which is correct.
  await db.delete(syllabi).where(eq(syllabi.id, id));
  revalidatePath("/teacher/syllabus");
}

/* ------------------------------------------------------------------ */
/* Weeks                                                               */
/* ------------------------------------------------------------------ */

export async function updateWeek(
  weekId: string,
  fields: { theme: string; grammarFocus: string },
): Promise<Result> {
  await requireTeacher();
  const week = await db.query.syllabusWeeks.findFirst({
    where: eq(syllabusWeeks.id, weekId),
  });
  if (!week) return { ok: false, error: "That week no longer exists." };

  await db
    .update(syllabusWeeks)
    .set({
      theme: fields.theme.trim(),
      grammarFocus: fields.grammarFocus.trim() || null,
    })
    .where(eq(syllabusWeeks.id, weekId));

  touch(week.syllabusId);
  return { ok: true };
}

export async function addWeek(syllabusId: string): Promise<Result> {
  await requireTeacher();
  const [last] = await db
    .select({ n: syllabusWeeks.weekNumber })
    .from(syllabusWeeks)
    .where(eq(syllabusWeeks.syllabusId, syllabusId))
    .orderBy(desc(syllabusWeeks.weekNumber))
    .limit(1);

  await db.insert(syllabusWeeks).values({
    syllabusId,
    weekNumber: (last?.n ?? 0) + 1,
    theme: "",
  });
  touch(syllabusId);
  return { ok: true };
}

/** Removes a week and closes the gap. See lib/syllabus-order. */
export async function deleteWeek(weekId: string): Promise<Result> {
  await requireTeacher();
  const week = await findWeek(weekId);
  if (!week) return { ok: false, error: "That week no longer exists." };

  await deleteWeekAndClose(week);
  touch(week.syllabusId);
  return { ok: true };
}

/**
 * Swaps a week with its neighbour — the move the whole content model was built
 * for. Nothing inside the week is touched; only its number changes, so classes,
 * materials and practice items all travel with it.
 */
export async function moveWeek(
  weekId: string,
  direction: "up" | "down",
): Promise<Result> {
  await requireTeacher();
  const week = await findWeek(weekId);
  if (!week) return { ok: false, error: "That week no longer exists." };

  await swapWeekWithNeighbour(week, direction);
  touch(week.syllabusId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Classes within a week                                               */
/* ------------------------------------------------------------------ */

/**
 * A week has two live classes. They are created on first view rather than at
 * syllabus-creation time, so an existing syllabus picks them up too.
 */
export async function ensureClassSessions(weekId: string) {
  const existing = await db
    .select({ classNumber: classSessions.classNumber })
    .from(classSessions)
    .where(eq(classSessions.syllabusWeekId, weekId));

  const missing = [1, 2].filter(
    (n) => !existing.some((e) => e.classNumber === n),
  );
  if (missing.length === 0) return;

  await db
    .insert(classSessions)
    .values(
      missing.map((n) => ({
        syllabusWeekId: weekId,
        classNumber: n,
        title: n === 1 ? "Class 1" : "Class 2",
      })),
    )
    .onConflictDoNothing();
}

export async function updateClassSession(
  sessionId: string,
  fields: { title: string; planMd: string },
): Promise<Result> {
  await requireTeacher();
  const session = await db.query.classSessions.findFirst({
    where: eq(classSessions.id, sessionId),
  });
  if (!session) return { ok: false, error: "That class no longer exists." };

  await db
    .update(classSessions)
    .set({
      title: fields.title.trim() || `Class ${session.classNumber}`,
      planMd: fields.planMd.trim() || null,
    })
    .where(eq(classSessions.id, sessionId));

  const week = await db.query.syllabusWeeks.findFirst({
    where: eq(syllabusWeeks.id, session.syllabusWeekId),
  });
  if (week) touch(week.syllabusId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Putting content into a week                                         */
/* ------------------------------------------------------------------ */

/** Powers the picker. Published items first — drafts are still offerable. */
export async function searchLibrary(filters: {
  q?: string;
  type?: string;
  level?: number;
}) {
  await requireTeacher();

  const where: SQL[] = [];
  if (filters.q) where.push(ilike(contentItems.title, `%${filters.q}%`));
  if (filters.type && CONTENT_TYPE_KEYS.includes(filters.type as "passage")) {
    where.push(eq(contentItems.type, filters.type as "passage"));
  }
  if (filters.level) {
    where.push(eq(contentItems.difficultyLevel, filters.level));
  }

  return db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      type: contentItems.type,
      difficultyLevel: contentItems.difficultyLevel,
      ageBand: contentItems.ageBand,
      audience: contentItems.audience,
      status: contentItems.status,
    })
    .from(contentItems)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(contentItems.status), desc(contentItems.updatedAt))
    .limit(50);
}

/** New rows go on the end of whichever list they are joining. */
async function nextSortOrder(
  table: typeof syllabusWeekItems | typeof classSessionMaterials,
  where: SQL,
) {
  const [row] = await db
    .select({ n: sql<number>`coalesce(max(sort_order), -1)` })
    .from(table)
    .where(where);
  return Number(row?.n ?? -1) + 1;
}

export async function addWeekItem(
  weekId: string,
  contentItemId: string,
): Promise<Result> {
  await requireTeacher();
  const week = await db.query.syllabusWeeks.findFirst({
    where: eq(syllabusWeeks.id, weekId),
  });
  if (!week) return { ok: false, error: "That week no longer exists." };

  const sortOrder = await nextSortOrder(
    syllabusWeekItems,
    eq(syllabusWeekItems.syllabusWeekId, weekId),
  );

  await db
    .insert(syllabusWeekItems)
    .values({ syllabusWeekId: weekId, contentItemId, sortOrder });

  touch(week.syllabusId);
  return { ok: true };
}

export async function removeWeekItem(rowId: string): Promise<Result> {
  await requireTeacher();
  const [row] = await db
    .delete(syllabusWeekItems)
    .where(eq(syllabusWeekItems.id, rowId))
    .returning({ weekId: syllabusWeekItems.syllabusWeekId });
  if (!row) return { ok: true };

  const week = await db.query.syllabusWeeks.findFirst({
    where: eq(syllabusWeeks.id, row.weekId),
  });
  if (week) touch(week.syllabusId);
  return { ok: true };
}

export async function moveWeekItem(
  rowId: string,
  direction: "up" | "down",
): Promise<Result> {
  await requireTeacher();
  const row = await db.query.syllabusWeekItems.findFirst({
    where: eq(syllabusWeekItems.id, rowId),
  });
  if (!row) return { ok: false, error: "That item is no longer there." };

  const siblings = await db
    .select({ id: syllabusWeekItems.id })
    .from(syllabusWeekItems)
    .where(eq(syllabusWeekItems.syllabusWeekId, row.syllabusWeekId))
    .orderBy(asc(syllabusWeekItems.sortOrder), asc(syllabusWeekItems.id));

  await reorderList(
    siblings.map((s) => s.id),
    rowId,
    direction,
    async (id, sortOrder) => {
      await db
        .update(syllabusWeekItems)
        .set({ sortOrder })
        .where(eq(syllabusWeekItems.id, id));
    },
  );

  const week = await db.query.syllabusWeeks.findFirst({
    where: eq(syllabusWeeks.id, row.syllabusWeekId),
  });
  if (week) touch(week.syllabusId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Putting content into a class                                        */
/* ------------------------------------------------------------------ */

export async function addClassMaterial(
  sessionId: string,
  contentItemId: string,
): Promise<Result> {
  await requireTeacher();
  const session = await db.query.classSessions.findFirst({
    where: eq(classSessions.id, sessionId),
  });
  if (!session) return { ok: false, error: "That class no longer exists." };

  const sortOrder = await nextSortOrder(
    classSessionMaterials,
    eq(classSessionMaterials.classSessionId, sessionId),
  );

  await db
    .insert(classSessionMaterials)
    .values({ classSessionId: sessionId, contentItemId, sortOrder });

  await touchBySession(session.syllabusWeekId);
  return { ok: true };
}

export async function updateClassMaterial(
  rowId: string,
  fields: {
    release: "before" | "during" | "after" | "never";
    audienceOverride: "" | "student" | "teacher" | "parent";
  },
): Promise<Result> {
  await requireTeacher();
  const [row] = await db
    .update(classSessionMaterials)
    .set({
      release: fields.release,
      audienceOverride: fields.audienceOverride || null,
    })
    .where(eq(classSessionMaterials.id, rowId))
    .returning({ sessionId: classSessionMaterials.classSessionId });
  if (!row) return { ok: false, error: "That material is no longer there." };

  const session = await db.query.classSessions.findFirst({
    where: eq(classSessions.id, row.sessionId),
  });
  if (session) await touchBySession(session.syllabusWeekId);
  return { ok: true };
}

export async function removeClassMaterial(rowId: string): Promise<Result> {
  await requireTeacher();
  const [row] = await db
    .delete(classSessionMaterials)
    .where(eq(classSessionMaterials.id, rowId))
    .returning({ sessionId: classSessionMaterials.classSessionId });
  if (!row) return { ok: true };

  const session = await db.query.classSessions.findFirst({
    where: eq(classSessions.id, row.sessionId),
  });
  if (session) await touchBySession(session.syllabusWeekId);
  return { ok: true };
}

export async function moveClassMaterial(
  rowId: string,
  direction: "up" | "down",
): Promise<Result> {
  await requireTeacher();
  const row = await db.query.classSessionMaterials.findFirst({
    where: eq(classSessionMaterials.id, rowId),
  });
  if (!row) return { ok: false, error: "That material is no longer there." };

  const siblings = await db
    .select({ id: classSessionMaterials.id })
    .from(classSessionMaterials)
    .where(eq(classSessionMaterials.classSessionId, row.classSessionId))
    .orderBy(asc(classSessionMaterials.sortOrder), asc(classSessionMaterials.id));

  await reorderList(
    siblings.map((s) => s.id),
    rowId,
    direction,
    async (id, sortOrder) => {
      await db
        .update(classSessionMaterials)
        .set({ sortOrder })
        .where(eq(classSessionMaterials.id, id));
    },
  );

  const session = await db.query.classSessions.findFirst({
    where: eq(classSessions.id, row.classSessionId),
  });
  if (session) await touchBySession(session.syllabusWeekId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

async function touchBySession(weekId: string) {
  const week = await db.query.syllabusWeeks.findFirst({
    where: eq(syllabusWeeks.id, weekId),
  });
  if (week) touch(week.syllabusId);
}

