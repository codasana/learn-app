"use server";

import { asc, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { childProfiles, contentItems, submissions } from "@/db/schema";
import { requireTeacher } from "@/lib/session";

export type Result = { ok: true } | { ok: false; error: string };

function touch(id?: string) {
  revalidatePath("/teacher/review");
  revalidatePath("/teacher");
  revalidatePath("/learn");
  if (id) revalidatePath(`/teacher/review/${id}`);
}

/** "0:42" — for an audio answer, where the length is the whole preview. */
function clock(seconds: number | null): string | null {
  if (seconds === null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Everything waiting, oldest first.
 *
 * Oldest first on purpose: a child who submitted on Monday should not be
 * behind one who submitted this morning because the newest looks freshest at
 * the top of a list. The wait is the thing being managed.
 *
 * This used to select writing only. It now returns whatever children have
 * handed in — a recording of a child speaking sits in the same queue as a
 * piece of writing, because it is the same job: a person has to answer it.
 */
export async function listForReview() {
  await requireTeacher();

  const rows = await db
    .select({
      id: submissions.id,
      childName: childProfiles.firstName,
      avatar: childProfiles.avatar,
      taskTitle: contentItems.title,
      taskType: contentItems.type,
      kind: submissions.kind,
      status: submissions.status,
      submittedAt: submissions.submittedAt,
      // `body` only for a preview line. `ai_draft` is never selected anywhere
      // a child could reach; here it is simply not needed.
      body: submissions.body,
      mediaSeconds: submissions.mediaSeconds,
    })
    .from(submissions)
    .innerJoin(childProfiles, eq(childProfiles.id, submissions.childId))
    .innerJoin(contentItems, eq(contentItems.id, submissions.contentItemId))
    .where(inArray(submissions.status, ["submitted", "ai_drafted"]))
    .orderBy(asc(submissions.submittedAt));

  // How long each has been waiting is computed here rather than in the page:
  // reading a clock during render is impure, and the answer belongs with the
  // data anyway. Three days is where a child stops expecting a reply.
  const now = Date.now();
  return rows.map((r) => {
    const days = Math.floor((now - r.submittedAt.getTime()) / 86_400_000);
    return {
      ...r,
      /** What to show in the list when there is no text to quote. */
      preview: r.body?.trim() || clock(r.mediaSeconds) || null,
      waitingLabel:
        days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`,
      overdue: days >= 3,
    };
  });
}

/** Recently sent back, so she can see what she has said lately. */
export async function listReleased(limit = 20) {
  await requireTeacher();

  return db
    .select({
      id: submissions.id,
      childName: childProfiles.firstName,
      avatar: childProfiles.avatar,
      taskTitle: contentItems.title,
      kind: submissions.kind,
      releasedAt: submissions.releasedAt,
    })
    .from(submissions)
    .innerJoin(childProfiles, eq(childProfiles.id, submissions.childId))
    .innerJoin(contentItems, eq(contentItems.id, submissions.contentItemId))
    .where(inArray(submissions.status, ["released", "redrafted"]))
    .orderBy(desc(submissions.releasedAt))
    .limit(limit);
}

const feedback = z.object({
  teacherFeedback: z.string().trim().min(1, "Write something before saving."),
});

/**
 * Saves without sending. The child sees nothing.
 *
 * Worth having separately from release: marking six pieces of work is an
 * evening's work, and losing half of it because the last one was interrupted
 * would be unforgivable.
 */
export async function saveFeedback(
  id: string,
  formData: FormData,
): Promise<Result> {
  await requireTeacher();

  const parsed = feedback.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await db
    .update(submissions)
    .set({ teacherFeedback: parsed.data.teacherFeedback })
    .where(eq(submissions.id, id));

  touch(id);
  return { ok: true };
}

/**
 * Sends it to the child.
 *
 * This is the only thing in the system that makes a response visible to a
 * child, and it is always a person pressing it. The rule the programme is
 * built on — nothing generated reaches a child unreviewed — is enforced here
 * by there being no other path: the child's page reads `teacher_feedback` and
 * only when the status says released.
 */
export async function releaseFeedback(
  id: string,
  formData: FormData,
): Promise<Result> {
  await requireTeacher();

  const parsed = feedback.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Write something before sending it back.",
    };
  }

  await db
    .update(submissions)
    .set({
      teacherFeedback: parsed.data.teacherFeedback,
      status: "released",
      releasedAt: new Date(),
    })
    .where(eq(submissions.id, id));

  touch(id);
  return { ok: true };
}

/** Puts it back in the queue — for a change of mind before the child looks. */
export async function unrelease(id: string): Promise<Result> {
  await requireTeacher();

  await db
    .update(submissions)
    .set({ status: "submitted", releasedAt: null })
    .where(eq(submissions.id, id));

  touch(id);
  return { ok: true };
}
