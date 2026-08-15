"use server";

import { and, asc, desc, eq, gte, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  attendance,
  childProfiles,
  enrollments,
  scheduledClasses,
} from "@/db/schema";
import {
  type Busy,
  conflicts,
  firstConflict,
  occurrences,
} from "@/lib/scheduling";
import { requireTeacher } from "@/lib/session";
import { addDays, dateIn, wallTimeToInstant } from "@/lib/time";

export type Result = { ok: true; note?: string } | { ok: false; error: string };

function touch(childId: string) {
  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  revalidatePath(`/teacher/students/${childId}`);
  revalidatePath("/learn");
}

/**
 * Everything already in the diary from today onwards.
 *
 * One teacher, so this is simply "her diary". When there are several it gains
 * a `teacherId` filter and nothing else changes — which is why the conflict
 * check takes a list rather than querying inside itself.
 */
async function diary(fromDate: string): Promise<(Busy & { childId: string })[]> {
  const rows = await db
    .select({
      id: scheduledClasses.id,
      startsAt: scheduledClasses.startsAt,
      durationMin: scheduledClasses.durationMin,
      childId: enrollments.childId,
      status: scheduledClasses.status,
    })
    .from(scheduledClasses)
    .innerJoin(
      enrollments,
      eq(enrollments.id, scheduledClasses.enrollmentId),
    )
    .where(gte(scheduledClasses.startsAt, new Date(`${fromDate}T00:00:00Z`)))
    .orderBy(asc(scheduledClasses.startsAt));

  // A cancelled class is not occupying the diary.
  return rows.filter((r) => r.status !== "cancelled");
}

/* ------------------------------------------------------------------ */
/* The recurring slot                                                  */
/* ------------------------------------------------------------------ */

const slotSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMin: z.number().int().min(15).max(180),
  timezone: z.string().min(1),
  meetingUrl: z.string().trim(),
});

export async function saveSlot(
  childId: string,
  input: z.infer<typeof slotSchema>,
): Promise<Result> {
  await requireTeacher();

  const parsed = slotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That slot isn't valid." };
  const v = parsed.data;

  if (v.meetingUrl && !/^https:\/\//.test(v.meetingUrl)) {
    return { ok: false, error: "A meeting link should start with https://" };
  }

  const [active] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(eq(enrollments.childId, childId), eq(enrollments.status, "active")),
    )
    .limit(1);

  if (!active) return { ok: false, error: "They are not on a syllabus yet." };

  await db
    .update(enrollments)
    .set({
      slotDays: v.days,
      slotTime: v.time,
      slotTimezone: v.timezone,
      durationMin: v.durationMin,
      meetingUrl: v.meetingUrl || null,
    })
    .where(eq(enrollments.id, active.id));

  touch(childId);
  return { ok: true };
}

/**
 * Puts the slot in the diary, up to a date.
 *
 * Refuses on the first collision rather than skipping it. A schedule with a
 * silent hole in it is worse than one that was not created: she would find out
 * in December, from a parent.
 *
 * Existing future classes for this child are cleared first, so pressing it
 * twice does not double-book them against themselves.
 */
export async function generateClasses(
  childId: string,
  weeks: number,
): Promise<Result> {
  const teacher = await requireTeacher();

  const [e] = await db
    .select()
    .from(enrollments)
    .where(
      and(eq(enrollments.childId, childId), eq(enrollments.status, "active")),
    )
    .limit(1);

  if (!e) return { ok: false, error: "They are not on a syllabus yet." };
  if (!e.slotTime || e.slotDays.length === 0) {
    return { ok: false, error: "Pick the days and a time first." };
  }

  const from = dateIn(e.slotTimezone, new Date());
  const to = addDays(from, weeks * 7);

  const planned = occurrences(
    {
      days: e.slotDays,
      time: e.slotTime,
      timezone: e.slotTimezone,
      durationMin: e.durationMin,
    },
    from,
    to,
  );
  if (planned.length === 0) return { ok: false, error: "That makes no classes." };

  // Everything still to come for this child goes, so a re-run replaces rather
  // than stacks. Past classes are a record and are never touched.
  await db
    .delete(scheduledClasses)
    .where(
      and(
        eq(scheduledClasses.enrollmentId, e.id),
        gte(scheduledClasses.startsAt, new Date()),
      ),
    );

  const busy = (await diary(from)).filter((d) => d.childId !== childId);
  const clash = firstConflict(planned, busy);
  if (clash) {
    const other = await childName(clash.against.id);
    return {
      ok: false,
      error: `That clashes with ${other} on ${dateIn(e.slotTimezone, clash.at)}. Move one of them first.`,
    };
  }

  await db.insert(scheduledClasses).values(
    planned.map((p) => ({
      enrollmentId: e.id,
      teacherId: teacher.id,
      startsAt: p.startsAt,
      durationMin: p.durationMin,
      meetingUrl: e.meetingUrl,
    })),
  );

  touch(childId);
  return { ok: true, note: `${planned.length} classes in the diary.` };
}

async function childName(scheduledClassId: string): Promise<string> {
  const [row] = await db
    .select({ name: childProfiles.firstName })
    .from(scheduledClasses)
    .innerJoin(enrollments, eq(enrollments.id, scheduledClasses.enrollmentId))
    .innerJoin(childProfiles, eq(childProfiles.id, enrollments.childId))
    .where(eq(scheduledClasses.id, scheduledClassId))
    .limit(1);
  return row?.name ?? "another class";
}

/* ------------------------------------------------------------------ */
/* Moving one class                                                    */
/* ------------------------------------------------------------------ */

/**
 * Moves a single class. The arrangement with the family happens on WhatsApp;
 * this is where the diary catches up with it.
 */
export async function rescheduleClass(
  scheduledClassId: string,
  date: string,
  time: string,
): Promise<Result> {
  await requireTeacher();

  const [row] = await db
    .select({
      id: scheduledClasses.id,
      durationMin: scheduledClasses.durationMin,
      childId: enrollments.childId,
      timezone: enrollments.slotTimezone,
    })
    .from(scheduledClasses)
    .innerJoin(enrollments, eq(enrollments.id, scheduledClasses.enrollmentId))
    .where(eq(scheduledClasses.id, scheduledClassId))
    .limit(1);

  if (!row) return { ok: false, error: "That class no longer exists." };

  const startsAt = wallTimeToInstant(date, time, row.timezone);
  const busy = await diary(dateIn(row.timezone, startsAt));

  const hit = conflicts(
    { startsAt, durationMin: row.durationMin },
    busy,
    scheduledClassId,
  );
  if (hit.length > 0) {
    const other = await childName(hit[0].id);
    return { ok: false, error: `That time is taken by ${other}.` };
  }

  await db
    .update(scheduledClasses)
    .set({ startsAt, status: "scheduled" })
    .where(eq(scheduledClasses.id, scheduledClassId));

  touch(row.childId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* After the class                                                     */
/* ------------------------------------------------------------------ */

/**
 * Marks who turned up.
 *
 * Attendance and the class's own status move together: a child marked absent
 * still had a class, and a cancelled class had nobody in it. Keeping them in
 * step here means no screen has to reconcile them later.
 */
export async function markAttendance(
  scheduledClassId: string,
  status: "present" | "absent" | "cancelled",
): Promise<Result> {
  await requireTeacher();

  const [row] = await db
    .select({ childId: enrollments.childId })
    .from(scheduledClasses)
    .innerJoin(enrollments, eq(enrollments.id, scheduledClasses.enrollmentId))
    .where(eq(scheduledClasses.id, scheduledClassId))
    .limit(1);

  if (!row) return { ok: false, error: "That class no longer exists." };

  await db
    .delete(attendance)
    .where(eq(attendance.scheduledClassId, scheduledClassId));

  await db.insert(attendance).values({
    scheduledClassId,
    childId: row.childId,
    status,
  });

  await db
    .update(scheduledClasses)
    .set({ status: status === "cancelled" ? "cancelled" : "completed" })
    .where(eq(scheduledClasses.id, scheduledClassId));

  touch(row.childId);
  return { ok: true };
}

/** Undo, for the wrong button at the end of a long evening. */
export async function clearAttendance(
  scheduledClassId: string,
): Promise<Result> {
  await requireTeacher();

  await db
    .delete(attendance)
    .where(eq(attendance.scheduledClassId, scheduledClassId));
  const [row] = await db
    .update(scheduledClasses)
    .set({ status: "scheduled" })
    .where(eq(scheduledClasses.id, scheduledClassId))
    .returning({ enrollmentId: scheduledClasses.enrollmentId });

  await touchByEnrolment(row?.enrollmentId ?? null);
  return { ok: true };
}

/**
 * `scheduled_classes.enrollment_id` is nullable — the column also serves group
 * classes, which belong to a class_group rather than one child. Nothing
 * creates those yet, but the type is honest about it, so this is too.
 */
async function touchByEnrolment(enrollmentId: string | null) {
  if (!enrollmentId) return;
  const [e] = await db
    .select({ childId: enrollments.childId })
    .from(enrollments)
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);
  if (e) touch(e.childId);
}

/** What this class covers, when it is not simply where the child is. */
export async function setClassUnit(
  scheduledClassId: string,
  syllabusUnitId: string | null,
): Promise<Result> {
  await requireTeacher();

  const [row] = await db
    .update(scheduledClasses)
    .set({ syllabusUnitId })
    .where(eq(scheduledClasses.id, scheduledClassId))
    .returning({ enrollmentId: scheduledClasses.enrollmentId });

  await touchByEnrolment(row?.enrollmentId ?? null);
  return { ok: true };
}

/** The child's upcoming classes, for their page. */
export async function upcomingFor(childId: string, limit = 8) {
  await requireTeacher();

  return db
    .select({
      id: scheduledClasses.id,
      startsAt: scheduledClasses.startsAt,
      durationMin: scheduledClasses.durationMin,
      status: scheduledClasses.status,
      meetingUrl: scheduledClasses.meetingUrl,
    })
    .from(scheduledClasses)
    .innerJoin(enrollments, eq(enrollments.id, scheduledClasses.enrollmentId))
    .where(
      and(
        eq(enrollments.childId, childId),
        gte(scheduledClasses.startsAt, new Date()),
        ne(scheduledClasses.status, "cancelled"),
      ),
    )
    .orderBy(asc(scheduledClasses.startsAt))
    .limit(limit);
}

/** Recent past classes, newest first — the attendance record. */
export async function recentFor(childId: string, limit = 6) {
  await requireTeacher();

  return db
    .select({
      id: scheduledClasses.id,
      startsAt: scheduledClasses.startsAt,
      status: scheduledClasses.status,
      attended: attendance.status,
    })
    .from(scheduledClasses)
    .innerJoin(enrollments, eq(enrollments.id, scheduledClasses.enrollmentId))
    .leftJoin(
      attendance,
      eq(attendance.scheduledClassId, scheduledClasses.id),
    )
    .where(eq(enrollments.childId, childId))
    .orderBy(desc(scheduledClasses.startsAt))
    .limit(limit);
}
