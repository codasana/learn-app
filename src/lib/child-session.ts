import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  childProfiles,
  contentItems,
  enrollments,
  syllabi,
  syllabusWeeks,
  syllabusWeekItems,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

/**
 * Who is learning, and what they are meant to be doing.
 *
 * Two ways in, and both have to work (spec §13D): a child signed in with their
 * own username, or a parent signed in and looking at one of their children. A
 * parent is the account of record and a child's login is optional, so neither
 * route can be the only one.
 *
 * Everything a child sees is derived here from their *active enrolment* — not
 * from a URL. A child cannot navigate to another week, another syllabus, or
 * another child by editing an address, because none of those are ever asked
 * for.
 */

export type LearnerContext = {
  childId: string;
  firstName: string;
  avatar: string;
  ageBand: "8_9" | "10_11" | "any";
  /** Null when nobody has put them on a syllabus yet. */
  enrolment: {
    id: string;
    syllabusId: string;
    syllabusName: string;
    currentWeek: number;
    weekId: string | null;
    theme: string | null;
  } | null;
  /** True when a parent is looking rather than the child. */
  viewedByParent: boolean;
};

/**
 * The current learner, or a redirect.
 *
 * `childId` is only honoured for a parent choosing between their own children,
 * and is checked against ownership. A child's own session ignores it entirely —
 * there is nothing for them to choose.
 */
export async function requireLearner(
  childId?: string,
): Promise<LearnerContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = (user as { role?: string }).role ?? "parent";

  let child;
  let viewedByParent = false;

  if (role === "student") {
    child = await db.query.childProfiles.findFirst({
      where: eq(childProfiles.userId, user.id),
    });
  } else if (role === "parent") {
    viewedByParent = true;
    const mine = await db
      .select()
      .from(childProfiles)
      .where(eq(childProfiles.parentId, user.id))
      .orderBy(asc(childProfiles.firstName));

    // An unknown or someone else's id falls back to the first child rather
    // than erroring: a parent fiddling with a URL should land somewhere sane,
    // and must never land on a child who is not theirs.
    child = childId ? mine.find((c) => c.id === childId) ?? mine[0] : mine[0];
  } else {
    // Teachers and owners have their own screens; this is not one of them.
    redirect("/teacher");
  }

  if (!child) redirect("/no-student");

  const [enrolment] = await db
    .select({
      id: enrollments.id,
      syllabusId: enrollments.syllabusId,
      syllabusName: syllabi.name,
      currentWeek: enrollments.currentWeek,
    })
    .from(enrollments)
    .innerJoin(syllabi, eq(syllabi.id, enrollments.syllabusId))
    .where(
      and(
        eq(enrollments.childId, child.id),
        eq(enrollments.status, "active"),
      ),
    )
    .limit(1);

  let weekId: string | null = null;
  let theme: string | null = null;

  if (enrolment) {
    const week = await db.query.syllabusWeeks.findFirst({
      where: and(
        eq(syllabusWeeks.syllabusId, enrolment.syllabusId),
        eq(syllabusWeeks.weekNumber, enrolment.currentWeek),
      ),
    });
    weekId = week?.id ?? null;
    theme = week?.theme || null;
  }

  return {
    childId: child.id,
    firstName: child.firstName,
    avatar: child.avatar,
    ageBand: child.ageBand,
    enrolment: enrolment ? { ...enrolment, weekId, theme } : null,
    viewedByParent,
  };
}

/**
 * This week's practice, in the order the teacher put it in.
 *
 * Only `student` items: a week also holds teacher notes and answer keys, and
 * the audience column is what keeps those off a child's screen. Drafts are
 * excluded too — unpublished means unfinished, and a half-written passage is
 * not something to hand a nine-year-old.
 */
export async function weekPractice(weekId: string) {
  return db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      type: contentItems.type,
      body: contentItems.body,
      fileUrl: contentItems.fileUrl,
      sortOrder: syllabusWeekItems.sortOrder,
    })
    .from(syllabusWeekItems)
    .innerJoin(
      contentItems,
      eq(contentItems.id, syllabusWeekItems.contentItemId),
    )
    .where(
      and(
        eq(syllabusWeekItems.syllabusWeekId, weekId),
        eq(contentItems.audience, "student"),
        eq(contentItems.status, "published"),
      ),
    )
    .orderBy(asc(syllabusWeekItems.sortOrder));
}
