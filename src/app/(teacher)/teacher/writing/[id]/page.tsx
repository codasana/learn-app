import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { childProfiles, contentItems, writingSubmissions } from "@/db/schema";
import { avatarEmoji } from "@/lib/avatars";
import { writingTaskBody } from "@/lib/content-schemas";
import { requireTeacher } from "@/lib/session";

import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Writing" };

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();
  const { id } = await params;

  const [row] = await db
    .select({
      id: writingSubmissions.id,
      body: writingSubmissions.body,
      status: writingSubmissions.status,
      teacherFeedback: writingSubmissions.teacherFeedback,
      submittedAt: writingSubmissions.submittedAt,
      releasedAt: writingSubmissions.releasedAt,
      childName: childProfiles.firstName,
      avatar: childProfiles.avatar,
      taskTitle: contentItems.title,
      taskBody: contentItems.body,
    })
    .from(writingSubmissions)
    .innerJoin(childProfiles, eq(childProfiles.id, writingSubmissions.childId))
    .innerJoin(
      contentItems,
      eq(contentItems.id, writingSubmissions.writingTaskId),
    )
    .where(eq(writingSubmissions.id, id))
    .limit(1);

  if (!row) notFound();

  const task = writingTaskBody.safeParse(row.taskBody);
  const focus = task.success ? task.data.feedbackFocus : "";
  const prompt = task.success ? task.data.prompt : "";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/teacher/writing"
          className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          ← All writing
        </Link>
        <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold">
          <span className="text-3xl" aria-hidden="true">
            {avatarEmoji(row.avatar)}
          </span>
          {row.childName}
        </h1>
        <p className="text-[var(--ink-muted)]">
          {row.taskTitle} · handed in{" "}
          {row.submittedAt.toLocaleDateString("en-GB")}
        </p>
      </div>

      {prompt && (
        <p className="rounded-[var(--radius)] bg-[var(--surface-sunken)] px-4 py-3 text-sm text-[var(--ink-muted)]">
          <span className="font-medium text-[var(--ink)]">They were asked:</span>{" "}
          {prompt}
        </p>
      )}

      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-sm text-[var(--ink-faint)]">
          What {row.childName} wrote
        </p>
        <p className="mt-2 text-lg leading-relaxed whitespace-pre-line">
          {row.body}
        </p>
      </section>

      <ReviewForm
        id={row.id}
        childName={row.childName}
        status={row.status}
        feedback={row.teacherFeedback ?? ""}
        focus={focus}
        releasedAt={row.releasedAt?.toISOString() ?? null}
      />
    </div>
  );
}
