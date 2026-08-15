import { and, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { childProfiles, enrollments, syllabi, users } from "@/db/schema";
import { avatarEmoji } from "@/lib/avatars";
import { AGE_BANDS } from "@/lib/content-types";
import { requireTeacher } from "@/lib/session";

import { availableSyllabi, unitsForChild } from "../actions";
import { ClassList } from "./class-list";
import { recentFor, upcomingFor } from "./schedule-actions";
import { SlotEditor } from "./slot-editor";
import { StudentEditor } from "./student-editor";

export const metadata: Metadata = { title: "Student" };

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();
  const { id } = await params;

  const child = await db.query.childProfiles.findFirst({
    where: eq(childProfiles.id, id),
  });
  if (!child) notFound();

  const parent = await db.query.users.findFirst({
    where: eq(users.id, child.parentId),
  });

  const childAccount = child.userId
    ? await db.query.users.findFirst({ where: eq(users.id, child.userId) })
    : null;

  const history = await db
    .select({
      id: enrollments.id,
      status: enrollments.status,
      currentUnit: enrollments.currentUnit,
      startDate: enrollments.startDate,
      syllabusId: syllabi.id,
      syllabusName: syllabi.name,
      unitLabel: syllabi.unitLabel,
    })
    .from(enrollments)
    .innerJoin(syllabi, eq(syllabi.id, enrollments.syllabusId))
    .where(eq(enrollments.childId, id))
    .orderBy(desc(enrollments.createdAt));

  const [active] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(eq(enrollments.childId, id), eq(enrollments.status, "active")),
    )
    .limit(1);

  const [syllabuses, units, upcoming, recent] = await Promise.all([
    availableSyllabi(),
    unitsForChild(id),
    upcomingFor(id),
    recentFor(id),
  ]);

  // The slot lives on the active enrolment; there is nothing to schedule
  // before a child is on a syllabus.
  const [live] = await db
    .select({
      slotDays: enrollments.slotDays,
      slotTime: enrollments.slotTime,
      slotTimezone: enrollments.slotTimezone,
      durationMin: enrollments.durationMin,
      meetingUrl: enrollments.meetingUrl,
    })
    .from(enrollments)
    .where(
      and(eq(enrollments.childId, id), eq(enrollments.status, "active")),
    )
    .limit(1);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/teacher/students"
          className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          ← All students
        </Link>
        <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold">
          <span className="text-3xl" aria-hidden="true">
            {avatarEmoji(child.avatar)}
          </span>
          {child.firstName}
        </h1>
        <p className="text-[var(--ink-muted)]">
          {AGE_BANDS[child.ageBand]} · {parent?.name} · {parent?.email}
          {parent?.whatsapp ? ` · ${parent.whatsapp}` : ""}
        </p>
        <p className="text-sm text-[var(--ink-faint)]">
          Times shown to this family in {parent?.timezone}
        </p>
      </div>

      {live && (
        <>
          <SlotEditor
            childId={child.id}
            firstName={child.firstName}
            teacherTimezone={live.slotTimezone}
            familyTimezone={parent?.timezone ?? live.slotTimezone}
            slot={{
              days: live.slotDays,
              time: live.slotTime,
              durationMin: live.durationMin,
              meetingUrl: live.meetingUrl,
            }}
          />

          <section className="space-y-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="font-medium">Coming up</h2>
            <ClassList
              firstName={child.firstName}
              teacherTimezone={live.slotTimezone}
              familyTimezone={parent?.timezone ?? live.slotTimezone}
              classes={upcoming.map((c) => ({
                id: c.id,
                startsAt: c.startsAt.toISOString(),
                durationMin: c.durationMin,
                status: c.status,
                meetingUrl: c.meetingUrl,
              }))}
            />
          </section>

          {recent.some((r) => r.attended) && (
            <section className="space-y-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="font-medium">Recent classes</h2>
              <ul className="space-y-1 text-sm text-[var(--ink-muted)]">
                {recent
                  .filter((r) => r.attended)
                  .map((r) => (
                    <li key={r.id}>
                      {r.startsAt.toLocaleDateString("en-GB")} ·{" "}
                      {r.attended === "present"
                        ? "came"
                        : r.attended === "absent"
                          ? "missed"
                          : "called off"}
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}

      <StudentEditor
        childId={child.id}
        firstName={child.firstName}
        activeEnrolmentId={active?.id ?? null}
        history={history}
        syllabuses={syllabuses}
        units={units}
        signIn={
          childAccount
            ? {
                username: childAccount.displayUsername ?? childAccount.username ?? "",
              }
            : null
        }
      />
    </div>
  );
}
