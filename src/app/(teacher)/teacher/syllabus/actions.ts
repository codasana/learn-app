"use server";

import {
  and,
  arrayContains,
  asc,
  desc,
  eq,
  ilike,
  type SQL,
  sql,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  classSessionMaterials,
  classSessions,
  contentItems,
  syllabi,
  syllabusUnits,
  syllabusUnitItems,
} from "@/db/schema";
import { CONTENT_TYPE_KEYS } from "@/lib/content-types";
import { requireTeacher } from "@/lib/session";
import { UNIT_LABEL_CHOICES } from "@/lib/unit-label";
import {
  deleteUnitAndClose,
  findUnit,
  reorderList,
  swapUnitWithNeighbour,
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
  units: z.coerce.number().int().min(1).max(52),
  unitLabel: z.string().trim().min(1).max(20).default("Week"),
});

/**
 * Creates the syllabus and its empty units in one go. A term is a known length,
 * and starting from twelve blank units is far less work than adding them one at
 * a time — units can still be added or removed afterwards.
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

  // Unknown words get a plural by the usual rule; the five offered are safe.
  const label = UNIT_LABEL_CHOICES.find(
    (c) => c.singular.toLowerCase() === v.unitLabel.toLowerCase(),
  ) ?? { singular: v.unitLabel, plural: `${v.unitLabel}s` };

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(syllabi)
      .values({
        name: v.name,
        createdBy: teacher.id,
        unitLabel: label.singular,
        unitLabelPlural: label.plural,
      })
      .returning({ id: syllabi.id });

    await tx.insert(syllabusUnits).values(
      Array.from({ length: v.units }, (_, i) => ({
        syllabusId: row.id,
        position: i + 1,
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
  // Units, classes and material rows cascade. Enrollments reference the
  // syllabus with `restrict`, so this fails loudly if a child is on it —
  // which is correct.
  await db.delete(syllabi).where(eq(syllabi.id, id));
  revalidatePath("/teacher/syllabus");
}

/* ------------------------------------------------------------------ */
/* Units                                                               */
/* ------------------------------------------------------------------ */

export async function updateUnit(
  unitId: string,
  fields: { theme: string; grammarFocus: string },
): Promise<Result> {
  await requireTeacher();
  const unit = await db.query.syllabusUnits.findFirst({
    where: eq(syllabusUnits.id, unitId),
  });
  if (!unit) return { ok: false, error: "That unit no longer exists." };

  await db
    .update(syllabusUnits)
    .set({
      theme: fields.theme.trim(),
      grammarFocus: fields.grammarFocus.trim() || null,
    })
    .where(eq(syllabusUnits.id, unitId));

  touch(unit.syllabusId);
  return { ok: true };
}

export async function addUnit(syllabusId: string): Promise<Result> {
  await requireTeacher();
  const [last] = await db
    .select({ n: syllabusUnits.position })
    .from(syllabusUnits)
    .where(eq(syllabusUnits.syllabusId, syllabusId))
    .orderBy(desc(syllabusUnits.position))
    .limit(1);

  await db.insert(syllabusUnits).values({
    syllabusId,
    position: (last?.n ?? 0) + 1,
    theme: "",
  });
  touch(syllabusId);
  return { ok: true };
}

/** Removes a unit and closes the gap. See lib/syllabus-order. */
export async function deleteUnit(unitId: string): Promise<Result> {
  await requireTeacher();
  const unit = await findUnit(unitId);
  if (!unit) return { ok: false, error: "That unit no longer exists." };

  await deleteUnitAndClose(unit);
  touch(unit.syllabusId);
  return { ok: true };
}

/**
 * Swaps a unit with its neighbour — the move the whole content model was built
 * for. Nothing inside the unit is touched; only its number changes, so classes,
 * materials and practice items all travel with it.
 */
export async function moveUnit(
  unitId: string,
  direction: "up" | "down",
): Promise<Result> {
  await requireTeacher();
  const unit = await findUnit(unitId);
  if (!unit) return { ok: false, error: "That unit no longer exists." };

  await swapUnitWithNeighbour(unit, direction);
  touch(unit.syllabusId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Classes within a unit                                               */
/* ------------------------------------------------------------------ */

/**
 * A unit has two live classes. They are created on first view rather than at
 * syllabus-creation time, so an existing syllabus picks them up too.
 */
export async function ensureClassSessions(unitId: string) {
  const existing = await db
    .select({ classNumber: classSessions.classNumber })
    .from(classSessions)
    .where(eq(classSessions.syllabusUnitId, unitId));

  const missing = [1, 2].filter(
    (n) => !existing.some((e) => e.classNumber === n),
  );
  if (missing.length === 0) return;

  await db
    .insert(classSessions)
    .values(
      missing.map((n) => ({
        syllabusUnitId: unitId,
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

  const unit = await db.query.syllabusUnits.findFirst({
    where: eq(syllabusUnits.id, session.syllabusUnitId),
  });
  if (unit) touch(unit.syllabusId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Putting content into a unit                                         */
/* ------------------------------------------------------------------ */

/** Powers the picker. Published items first — drafts are still offerable. */
export async function searchLibrary(filters: {
  q?: string;
  type?: string;
  tag?: string;
}) {
  await requireTeacher();

  const where: SQL[] = [];
  if (filters.q) where.push(ilike(contentItems.title, `%${filters.q}%`));
  if (filters.type && CONTENT_TYPE_KEYS.includes(filters.type as "passage")) {
    where.push(eq(contentItems.type, filters.type as "passage"));
  }
  if (filters.tag) {
    where.push(arrayContains(contentItems.tags, [filters.tag.toLowerCase()]));
  }

  return db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      type: contentItems.type,
      tags: contentItems.tags,
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
  table: typeof syllabusUnitItems | typeof classSessionMaterials,
  where: SQL,
) {
  const [row] = await db
    .select({ n: sql<number>`coalesce(max(sort_order), -1)` })
    .from(table)
    .where(where);
  return Number(row?.n ?? -1) + 1;
}

export async function addUnitItem(
  unitId: string,
  contentItemId: string,
): Promise<Result> {
  await requireTeacher();
  const unit = await db.query.syllabusUnits.findFirst({
    where: eq(syllabusUnits.id, unitId),
  });
  if (!unit) return { ok: false, error: "That unit no longer exists." };

  const sortOrder = await nextSortOrder(
    syllabusUnitItems,
    eq(syllabusUnitItems.syllabusUnitId, unitId),
  );

  await db
    .insert(syllabusUnitItems)
    .values({ syllabusUnitId: unitId, contentItemId, sortOrder });

  touch(unit.syllabusId);
  return { ok: true };
}

export async function removeUnitItem(rowId: string): Promise<Result> {
  await requireTeacher();
  const [row] = await db
    .delete(syllabusUnitItems)
    .where(eq(syllabusUnitItems.id, rowId))
    .returning({ unitId: syllabusUnitItems.syllabusUnitId });
  if (!row) return { ok: true };

  const unit = await db.query.syllabusUnits.findFirst({
    where: eq(syllabusUnits.id, row.unitId),
  });
  if (unit) touch(unit.syllabusId);
  return { ok: true };
}

export async function moveUnitItem(
  rowId: string,
  direction: "up" | "down",
): Promise<Result> {
  await requireTeacher();
  const row = await db.query.syllabusUnitItems.findFirst({
    where: eq(syllabusUnitItems.id, rowId),
  });
  if (!row) return { ok: false, error: "That item is no longer there." };

  const siblings = await db
    .select({ id: syllabusUnitItems.id })
    .from(syllabusUnitItems)
    .where(eq(syllabusUnitItems.syllabusUnitId, row.syllabusUnitId))
    .orderBy(asc(syllabusUnitItems.sortOrder), asc(syllabusUnitItems.id));

  await reorderList(
    siblings.map((s) => s.id),
    rowId,
    direction,
    async (id, sortOrder) => {
      await db
        .update(syllabusUnitItems)
        .set({ sortOrder })
        .where(eq(syllabusUnitItems.id, id));
    },
  );

  const unit = await db.query.syllabusUnits.findFirst({
    where: eq(syllabusUnits.id, row.syllabusUnitId),
  });
  if (unit) touch(unit.syllabusId);
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

  await touchBySession(session.syllabusUnitId);
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
  if (session) await touchBySession(session.syllabusUnitId);
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
  if (session) await touchBySession(session.syllabusUnitId);
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
  if (session) await touchBySession(session.syllabusUnitId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

async function touchBySession(unitId: string) {
  const unit = await db.query.syllabusUnits.findFirst({
    where: eq(syllabusUnits.id, unitId),
  });
  if (unit) touch(unit.syllabusId);
}

