"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  childProfiles,
  enrollments,
  syllabi,
  syllabusUnits,
  users,
} from "@/db/schema";
import { createChildLogin, resetChildPassword } from "@/lib/child-accounts";
import { createAccount } from "@/lib/create-account";
import { readablePassword } from "@/lib/passwords";
import { requireTeacher } from "@/lib/session";

export type Result = { ok: true } | { ok: false; error: string };

function touch(childId?: string) {
  revalidatePath("/teacher/students");
  revalidatePath("/teacher");
  if (childId) revalidatePath(`/teacher/students/${childId}`);
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

export async function listStudents() {
  await requireTeacher();

  return db
    .select({
      childId: childProfiles.id,
      firstName: childProfiles.firstName,
      avatar: childProfiles.avatar,
      ageBand: childProfiles.ageBand,
      childUserId: childProfiles.userId,
      parentId: users.id,
      parentName: users.name,
      parentEmail: users.email,
      enrollmentId: enrollments.id,
      currentUnit: enrollments.currentUnit,
      enrollmentStatus: enrollments.status,
      syllabusName: syllabi.name,
      unitLabel: syllabi.unitLabel,
    })
    .from(childProfiles)
    .innerJoin(users, eq(users.id, childProfiles.parentId))
    .leftJoin(
      enrollments,
      and(
        eq(enrollments.childId, childProfiles.id),
        eq(enrollments.status, "active"),
      ),
    )
    .leftJoin(syllabi, eq(syllabi.id, enrollments.syllabusId))
    .orderBy(asc(childProfiles.firstName));
}

/** Published syllabuses only — a draft is not something to put a child on. */
export async function availableSyllabi() {
  await requireTeacher();
  return db
    .select({ id: syllabi.id, name: syllabi.name })
    .from(syllabi)
    .where(eq(syllabi.status, "published"))
    .orderBy(desc(syllabi.createdAt));
}

/* ------------------------------------------------------------------ */
/* Adding a family                                                     */
/* ------------------------------------------------------------------ */

const newFamily = z.object({
  parentName: z.string().trim().min(1, "Add the parent's name."),
  parentEmail: z.string().trim().email("That email doesn't look right."),
  whatsapp: z.string().trim().optional(),
  timezone: z.string().trim().min(1),
  childFirstName: z.string().trim().min(1, "Add the child's first name."),
  childAgeBand: z.enum(["8_9", "10_11", "any"]),
  avatar: z.string().trim().min(1),
});

export type FamilyResult =
  | { ok: true; childId: string; parentPassword: string | null }
  | { ok: false; error: string };

/**
 * Creates the parent account and the child profile together.
 *
 * There is no public sign-up (spec §13D), so this is the only way a family
 * gets in. If the parent already exists — a second child, or they came through
 * an enquiry — the existing account is reused and no new password is made.
 *
 * The one-time password is returned to be shown on screen ONCE, for the
 * teacher to pass on however she already talks to that family. It is never
 * emailed: a password in an inbox outlives the conversation. A proper
 * set-your-own-password invite link is the right answer and is not built yet.
 */
export async function createFamily(formData: FormData): Promise<FamilyResult> {
  await requireTeacher();

  const parsed = newFamily.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const v = parsed.data;
  const email = v.parentEmail.toLowerCase();

  let parent = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  let parentPassword: string | null = null;

  if (parent) {
    if (parent.role === "student") {
      return {
        ok: false,
        error: "That email belongs to a student account, not a parent.",
      };
    }
  } else {
    parentPassword = readablePassword();

    // Deliberately NOT signUpEmail: that would hand the teacher this parent's
    // session and sign her out of her own. See lib/create-account.
    const created = await createAccount({
      email,
      name: v.parentName,
      password: parentPassword,
      role: "parent",
      timezone: v.timezone,
      whatsapp: v.whatsapp || null,
    });

    parent = await db.query.users.findFirst({
      where: eq(users.id, created.id),
    });
  }

  if (!parent) return { ok: false, error: "Could not create that account." };

  const [child] = await db
    .insert(childProfiles)
    .values({
      parentId: parent.id,
      firstName: v.childFirstName,
      ageBand: v.childAgeBand,
      avatar: v.avatar,
    })
    .returning({ id: childProfiles.id });

  touch(child.id);
  return { ok: true, childId: child.id, parentPassword };
}

/** A sibling on an existing parent account. */
export async function addChild(
  parentId: string,
  formData: FormData,
): Promise<FamilyResult> {
  await requireTeacher();

  const schema = z.object({
    childFirstName: z.string().trim().min(1, "Add the child's first name."),
    childAgeBand: z.enum(["8_9", "10_11", "any"]),
    avatar: z.string().trim().min(1),
  });

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const [child] = await db
    .insert(childProfiles)
    .values({
      parentId,
      firstName: parsed.data.childFirstName,
      ageBand: parsed.data.childAgeBand,
      avatar: parsed.data.avatar,
    })
    .returning({ id: childProfiles.id });

  touch(child.id);
  return { ok: true, childId: child.id, parentPassword: null };
}

/* ------------------------------------------------------------------ */
/* Enrolment — putting a child on a syllabus                           */
/* ------------------------------------------------------------------ */

/**
 * One active enrolment per child at a time.
 *
 * Moving a child to a different syllabus completes the old enrolment rather
 * than deleting it — what they did last term is a record, and their vocabulary
 * memory keys on the word rather than the unit, so nothing is lost by moving.
 */
export async function enrolChild(
  childId: string,
  syllabusId: string,
): Promise<Result> {
  const teacher = await requireTeacher();

  const child = await db.query.childProfiles.findFirst({
    where: eq(childProfiles.id, childId),
  });
  if (!child) return { ok: false, error: "That child no longer exists." };

  const syllabus = await db.query.syllabi.findFirst({
    where: eq(syllabi.id, syllabusId),
  });
  if (!syllabus) return { ok: false, error: "That syllabus no longer exists." };
  if (syllabus.status !== "published") {
    return { ok: false, error: "Publish the syllabus before putting a child on it." };
  }

  await db
    .update(enrollments)
    .set({ status: "completed", completedAt: new Date() })
    .where(
      and(eq(enrollments.childId, childId), eq(enrollments.status, "active")),
    );

  await db.insert(enrollments).values({
    childId,
    syllabusId,
    teacherId: teacher.id,
    startDate: new Date().toISOString().slice(0, 10),
  });

  touch(childId);
  return { ok: true };
}

/**
 * Every unit of the child's syllabus, so she can move them anywhere.
 *
 * Anywhere is the point. A unit takes as long as it takes: one child covers it
 * in a single class, another needs four, and a third skips it because they can
 * already do it. Forward, back, or three ahead — the system has no opinion.
 */
export async function unitsForChild(childId: string) {
  await requireTeacher();

  const [active] = await db
    .select({ syllabusId: enrollments.syllabusId })
    .from(enrollments)
    .where(
      and(eq(enrollments.childId, childId), eq(enrollments.status, "active")),
    )
    .limit(1);

  if (!active) return [];

  return db
    .select({
      position: syllabusUnits.position,
      theme: syllabusUnits.theme,
    })
    .from(syllabusUnits)
    .where(eq(syllabusUnits.syllabusId, active.syllabusId))
    .orderBy(asc(syllabusUnits.position));
}

/**
 * Moves a child to a unit. Any unit.
 *
 * There is deliberately no rule behind this and nothing computes it. Not "when
 * both classes are done" — a unit does not have a fixed number of classes and
 * a child does not take a fixed number of them. Not a date, either: how long a
 * unit takes has no connection to the calendar.
 *
 * Sheeba is the one who knows whether a child has got it. This records her
 * decision and does nothing clever with it.
 */
export async function moveToUnit(
  childId: string,
  position: number,
): Promise<Result> {
  await requireTeacher();

  const [active] = await db
    .select({ id: enrollments.id, syllabusId: enrollments.syllabusId })
    .from(enrollments)
    .where(
      and(eq(enrollments.childId, childId), eq(enrollments.status, "active")),
    )
    .limit(1);

  if (!active) return { ok: false, error: "They are not on a syllabus." };

  const unit = await db.query.syllabusUnits.findFirst({
    where: and(
      eq(syllabusUnits.syllabusId, active.syllabusId),
      eq(syllabusUnits.position, position),
    ),
  });
  if (!unit) return { ok: false, error: "That unit is not in their syllabus." };

  await db
    .update(enrollments)
    .set({ currentUnit: position })
    .where(eq(enrollments.id, active.id));

  touch(childId);
  return { ok: true };
}

const enrolmentUpdate = z.object({
  status: z.enum(["active", "paused", "completed", "withdrawn"]),
  currentUnit: z.coerce.number().int().min(1).max(52),
});

export async function updateEnrolment(
  enrollmentId: string,
  formData: FormData,
): Promise<Result> {
  await requireTeacher();

  const parsed = enrolmentUpdate.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const [row] = await db
    .update(enrollments)
    .set({
      status: parsed.data.status,
      currentUnit: parsed.data.currentUnit,
      completedAt:
        parsed.data.status === "completed" ? new Date() : null,
    })
    .where(eq(enrollments.id, enrollmentId))
    .returning({ childId: enrollments.childId });

  touch(row?.childId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* The child's own sign-in                                             */
/* ------------------------------------------------------------------ */

/**
 * Ownership is checked against the child's real parent, not the caller — the
 * teacher is setting this up on the family's behalf, and the rule that a
 * login belongs to exactly one parent account must hold either way.
 */
export async function createLogin(
  childId: string,
  formData: FormData,
): Promise<{ ok: true; username: string; password: string } | { ok: false; error: string }> {
  await requireTeacher();

  const child = await db.query.childProfiles.findFirst({
    where: eq(childProfiles.id, childId),
  });
  if (!child) return { ok: false, error: "That child no longer exists." };

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  const result = await createChildLogin({
    parentId: child.parentId,
    childId,
    username,
    password,
  });

  if (!result.ok) return result;

  touch(childId);
  return { ok: true, username: result.username, password };
}

export async function resetLogin(
  childId: string,
  password: string,
): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  await requireTeacher();

  const child = await db.query.childProfiles.findFirst({
    where: eq(childProfiles.id, childId),
  });
  if (!child) return { ok: false, error: "That child no longer exists." };

  const result = await resetChildPassword({
    parentId: child.parentId,
    childId,
    newPassword: password,
  });

  if (!result.ok) return result;

  touch(childId);
  return { ok: true, password };
}

/** A fresh readable password, for the "suggest one" button. */
export async function suggestPassword(): Promise<string> {
  await requireTeacher();
  return readablePassword();
}
