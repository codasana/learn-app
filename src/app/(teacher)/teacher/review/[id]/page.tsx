import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { childProfiles, contentItems, submissions } from "@/db/schema";
import { avatarEmoji } from "@/lib/avatars";
import { reviewPrompt } from "@/lib/content-schemas";
import { presignedRead } from "@/lib/r2";
import { requireTeacher } from "@/lib/session";

import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "To review" };

export default async function ReviewOnePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();
  const { id } = await params;

  const [row] = await db
    .select({
      id: submissions.id,
      kind: submissions.kind,
      body: submissions.body,
      mediaUrl: submissions.mediaUrl,
      payload: submissions.payload,
      status: submissions.status,
      teacherFeedback: submissions.teacherFeedback,
      submittedAt: submissions.submittedAt,
      releasedAt: submissions.releasedAt,
      childName: childProfiles.firstName,
      avatar: childProfiles.avatar,
      taskTitle: contentItems.title,
      taskBody: contentItems.body,
    })
    .from(submissions)
    .innerJoin(childProfiles, eq(childProfiles.id, submissions.childId))
    .innerJoin(contentItems, eq(contentItems.id, submissions.contentItemId))
    .where(eq(submissions.id, id))
    .limit(1);

  if (!row) notFound();

  /*
   * A child's voice and a child's handwriting are the two most personal things
   * in this system, so the objects are private and reached through a URL that
   * expires. Never render row.mediaUrl directly.
   */
  const mediaSrc = row.mediaUrl ? await presignedRead(row.mediaUrl) : null;

  /*
   * Both task schemas carry a prompt and a feedback focus, and those two are
   * all this screen needs. Pulling just them — rather than parsing as one
   * specific type and relying on the other's fields lining up — means a third
   * kind of task shows its prompt here without touching this file.
   */
  const task = reviewPrompt.safeParse(row.taskBody);
  const focus = task.success ? task.data.feedbackFocus : "";
  const prompt = task.success ? task.data.prompt : "";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/teacher/review"
          className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          ← Everything to review
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
          <span className="font-medium text-[var(--ink)]">
            They were asked:
          </span>{" "}
          {prompt}
        </p>
      )}

      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-sm text-[var(--ink-faint)]">
          What {row.childName} handed in
        </p>
        <Answer
          kind={row.kind}
          body={row.body}
          mediaSrc={mediaSrc}
          payload={row.payload}
        />
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

/**
 * The answer, drawn the way it was given.
 *
 * Every branch here is a shape a child can hand in. A shape with no branch
 * falls through to the last case and says so plainly rather than rendering
 * nothing — an empty panel would read as "the child submitted nothing", which
 * is the one wrong thing to tell a teacher.
 */
function Answer({
  kind,
  body,
  mediaSrc,
  payload,
}: {
  kind: string;
  body: string | null;
  mediaSrc: string | null;
  payload: unknown;
}) {
  if (kind === "text") {
    return (
      <p className="mt-2 text-lg leading-relaxed whitespace-pre-line">{body}</p>
    );
  }

  if (kind === "audio" && mediaSrc) {
    return (
      <div className="mt-3 space-y-3">
        <audio controls preload="metadata" src={mediaSrc} className="w-full" />
        {body && (
          <p className="text-sm text-[var(--ink-muted)] italic">{body}</p>
        )}
      </div>
    );
  }

  if (kind === "photo" && mediaSrc) {
    return (
      // Not next/image: the src is a signed URL that expires, so there is
      // nothing stable for the optimiser to cache.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={mediaSrc}
        alt="What they handed in"
        className="mt-3 max-h-[70vh] w-auto rounded-[var(--radius)]"
      />
    );
  }

  if (kind === "file" && mediaSrc) {
    return (
      <p className="mt-3">
        <a
          href={mediaSrc}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--primary)] hover:underline"
        >
          Open what they sent
        </a>
      </p>
    );
  }

  if (kind === "answers") {
    return (
      <pre className="mt-3 overflow-x-auto rounded-[var(--radius)] bg-[var(--surface-sunken)] p-4 text-sm">
        {JSON.stringify(payload, null, 2)}
      </pre>
    );
  }

  return (
    <p className="mt-2 text-[var(--ink-muted)]">
      They handed something in, but this screen cannot show it yet.
    </p>
  );
}
