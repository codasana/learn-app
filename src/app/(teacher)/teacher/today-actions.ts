"use server";

import { and, asc, eq, gte, lt } from "drizzle-orm";

import { db } from "@/db";
import {
  attendance,
  childProfiles,
  enrollments,
  scheduledClasses,
  syllabi,
  syllabusUnits,
} from "@/db/schema";
import { requireTeacher } from "@/lib/session";
import { dateIn } from "@/lib/time";

/**
 * Today's classes, in order.
 *
 * The unit each class covers is DERIVED from where the child currently is,
 * unless the class carries an override. Deriving means that moving a child
 * forward on Tuesday changes what Thursday's class says, without anyone
 * editing Thursday — which is the behaviour you want when progress is a
 * judgement rather than a schedule.
 */
export async function classesOn(dateStr?: string) {
  const teacher = await requireTeacher();
  const tz = (teacher as { timezone?: string }).timezone ?? "Asia/Kolkata";

  const day = dateStr ?? dateIn(tz, new Date());

  // A calendar day in her zone, expressed as an instant range.
  const from = new Date(`${day}T00:00:00Z`);
  const to = new Date(`${day}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + 2);

  const rows = await db
    .select({
      id: scheduledClasses.id,
      startsAt: scheduledClasses.startsAt,
      durationMin: scheduledClasses.durationMin,
      status: scheduledClasses.status,
      meetingUrl: scheduledClasses.meetingUrl,
      overrideUnitId: scheduledClasses.syllabusUnitId,

      childId: childProfiles.id,
      firstName: childProfiles.firstName,
      avatar: childProfiles.avatar,

      currentUnit: enrollments.currentUnit,
      syllabusId: enrollments.syllabusId,
      syllabusName: syllabi.name,
      unitLabel: syllabi.unitLabel,
      enrolmentMeetingUrl: enrollments.meetingUrl,

      attended: attendance.status,
    })
    .from(scheduledClasses)
    .innerJoin(enrollments, eq(enrollments.id, scheduledClasses.enrollmentId))
    .innerJoin(childProfiles, eq(childProfiles.id, enrollments.childId))
    .innerJoin(syllabi, eq(syllabi.id, enrollments.syllabusId))
    .leftJoin(attendance, eq(attendance.scheduledClassId, scheduledClasses.id))
    .where(
      and(
        gte(scheduledClasses.startsAt, from),
        lt(scheduledClasses.startsAt, to),
      ),
    )
    .orderBy(asc(scheduledClasses.startsAt));

  // Only the ones that land on this day in HER zone. The query brackets two
  // UTC days because a 9pm class in India is already tomorrow in UTC terms.
  const onDay = rows.filter((r) => dateIn(tz, r.startsAt) === day);
  if (onDay.length === 0) return { timezone: tz, date: day, classes: [] };

  // One query for every unit in play, rather than one per class.
  const unitRows = await db
    .select({
      id: syllabusUnits.id,
      syllabusId: syllabusUnits.syllabusId,
      position: syllabusUnits.position,
      theme: syllabusUnits.theme,
    })
    .from(syllabusUnits);

  const classes = onDay.map((r) => {
    const override = r.overrideUnitId
      ? unitRows.find((u) => u.id === r.overrideUnitId)
      : undefined;
    const derived = unitRows.find(
      (u) => u.syllabusId === r.syllabusId && u.position === r.currentUnit,
    );
    const unit = override ?? derived;

    return {
      id: r.id,
      startsAt: r.startsAt.toISOString(),
      durationMin: r.durationMin,
      status: r.status,
      attended: r.attended,
      meetingUrl: r.meetingUrl ?? r.enrolmentMeetingUrl,
      childId: r.childId,
      firstName: r.firstName,
      avatar: r.avatar,
      unitLabel: r.unitLabel,
      unitPosition: unit?.position ?? r.currentUnit,
      unitTheme: unit?.theme ?? null,
      /** True when she has pinned this class to something else. */
      unitOverridden: Boolean(override),
    };
  });

  return { timezone: tz, date: day, classes };
}
