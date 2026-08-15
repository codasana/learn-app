"use server";

import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  attendance,
  cardStates,
  childProfiles,
  contentItems,
  enquiries,
  enrollments,
  scheduledClasses,
  submissions,
} from "@/db/schema";
import { requireTeacher } from "@/lib/session";

/**
 * What needs her, and nothing else.
 *
 * This replaced a grid of counts — things written, children, syllabuses. Those
 * answered questions nobody asks: she knows how many children she teaches, and
 * "13 content items" is not a reason to do anything. A number that never
 * prompts an action is furniture.
 *
 * Everything below is a specific child and a specific reason, and the list is
 * empty when there is genuinely nothing. An empty list is the most useful
 * state this screen has.
 */

export type Attention = {
  kind: "missed" | "quiet" | "handed-in" | "enquiry";
  childId?: string;
  title: string;
  detail: string;
  href: string;
};

/** What to call the thing they handed in, in a sentence. */
const NOUN: Record<string, string> = {
  text: "writing",
  audio: "recording",
  photo: "photo",
  file: "file",
  answers: "answers",
};

/** No practice in this many days counts as gone quiet. */
const QUIET_DAYS = 7;

export async function needsAttention(): Promise<Attention[]> {
  await requireTeacher();

  const out: Attention[] = [];
  const now = new Date();
  const quietBefore = new Date(now.getTime() - QUIET_DAYS * 864e5);

  /* --- children who missed their most recent class ---------------- */
  const recent = await db
    .select({
      childId: childProfiles.id,
      firstName: childProfiles.firstName,
      startsAt: scheduledClasses.startsAt,
      status: attendance.status,
    })
    .from(attendance)
    .innerJoin(
      scheduledClasses,
      eq(scheduledClasses.id, attendance.scheduledClassId),
    )
    .innerJoin(childProfiles, eq(childProfiles.id, attendance.childId))
    .where(gte(scheduledClasses.startsAt, new Date(now.getTime() - 14 * 864e5)))
    .orderBy(desc(scheduledClasses.startsAt));

  const seen = new Set<string>();
  for (const r of recent) {
    if (seen.has(r.childId)) continue;
    seen.add(r.childId);
    if (r.status === "absent") {
      out.push({
        kind: "missed",
        childId: r.childId,
        title: `${r.firstName} missed their last class`,
        detail: r.startsAt.toLocaleDateString("en-GB"),
        href: `/teacher/students/${r.childId}`,
      });
    }
  }

  /* --- children who have stopped practising ----------------------- */
  const learning = await db
    .select({
      childId: childProfiles.id,
      firstName: childProfiles.firstName,
    })
    .from(enrollments)
    .innerJoin(childProfiles, eq(childProfiles.id, enrollments.childId))
    .where(eq(enrollments.status, "active"));

  if (learning.length > 0) {
    const lastSeen = await db
      .select({
        childId: cardStates.childId,
        last: sql<Date | null>`max(${cardStates.lastReviewedAt})`,
      })
      .from(cardStates)
      .where(
        inArray(
          cardStates.childId,
          learning.map((l) => l.childId),
        ),
      )
      .groupBy(cardStates.childId);

    for (const child of learning) {
      const row = lastSeen.find((l) => l.childId === child.childId);
      const last = row?.last ? new Date(row.last) : null;

      if (!last) {
        out.push({
          kind: "quiet",
          childId: child.childId,
          title: `${child.firstName} has not started practising`,
          detail: "No word practice yet",
          href: `/teacher/students/${child.childId}`,
        });
      } else if (last < quietBefore) {
        const days = Math.floor((now.getTime() - last.getTime()) / 864e5);
        out.push({
          kind: "quiet",
          childId: child.childId,
          title: `${child.firstName} has gone quiet`,
          detail: `No practice for ${days} days`,
          href: `/teacher/students/${child.childId}`,
        });
      }
    }
  }

  /* --- work that has been waiting a while ------------------------- */
  const waiting = await db
    .select({
      id: submissions.id,
      firstName: childProfiles.firstName,
      submittedAt: submissions.submittedAt,
      kind: submissions.kind,
      taskTitle: contentItems.title,
    })
    .from(submissions)
    .innerJoin(childProfiles, eq(childProfiles.id, submissions.childId))
    .innerJoin(contentItems, eq(contentItems.id, submissions.contentItemId))
    .where(
      and(
        inArray(submissions.status, ["submitted", "ai_drafted"]),
        lt(submissions.submittedAt, new Date(now.getTime() - 3 * 864e5)),
      ),
    )
    .orderBy(submissions.submittedAt);

  for (const w of waiting) {
    const days = Math.floor(
      (now.getTime() - w.submittedAt.getTime()) / 864e5,
    );
    out.push({
      kind: "handed-in",
      // Name the thing rather than assuming prose — this queue holds
      // recordings and photographed work too.
      title: `${w.firstName}'s ${NOUN[w.kind]} has waited ${days} days`,
      detail: w.taskTitle,
      href: `/teacher/review/${w.id}`,
    });
  }

  /* --- families mid-decision -------------------------------------- */
  const open = await db
    .select({
      id: enquiries.id,
      parentName: enquiries.parentName,
      childFirstName: enquiries.childFirstName,
      status: enquiries.status,
    })
    .from(enquiries)
    .where(inArray(enquiries.status, ["new", "class_scheduled", "class_done"]));

  for (const e of open) {
    out.push({
      kind: "enquiry",
      title:
        e.status === "new"
          ? `${e.parentName ?? "Someone"} is waiting to hear back`
          : e.status === "class_scheduled"
            ? `${e.childFirstName ?? e.parentName} has a free class booked`
            : `${e.childFirstName ?? e.parentName} had their free class`,
      detail:
        e.status === "class_done"
          ? "Send the report, or let them go"
          : "In the enquiries list",
      href: `/teacher/enquiries/${e.id}`,
    });
  }

  return collapse(out);
}

/**
 * One row per child.
 *
 * A child who missed their class and then stopped practising is one situation,
 * not two. Listing it twice makes the list look longer than the problem is,
 * and she reads the length of this list as how much is wrong.
 */
function collapse(rows: Attention[]): Attention[] {
  const out: Attention[] = [];

  for (const r of rows) {
    if (!r.childId) {
      out.push(r);
      continue;
    }
    const existing = out.find((o) => o.childId === r.childId);
    if (existing) {
      existing.detail = `${existing.detail} · ${r.detail}`;
    } else {
      out.push({ ...r });
    }
  }

  return out;
}
