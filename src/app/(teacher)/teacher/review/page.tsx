import type { Metadata } from "next";
import Link from "next/link";

import { avatarEmoji } from "@/lib/avatars";
import { SUBMISSION_KINDS, type SubmissionKind } from "@/lib/content-types";
import { requireTeacher } from "@/lib/session";

import { listForReview, listReleased } from "./actions";

export const metadata: Metadata = { title: "To review" };

/**
 * What shape the answer took, so she knows before opening it whether this is
 * two minutes of reading or a recording she needs sound for.
 */
function KindChip({ kind }: { kind: SubmissionKind }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-xs font-medium text-[var(--ink-muted)]">
      {SUBMISSION_KINDS[kind]?.label ?? kind}
    </span>
  );
}

export default async function ReviewPage() {
  await requireTeacher();

  const [waiting, released] = await Promise.all([
    listForReview(),
    listReleased(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">To review</h1>
        <p className="max-w-2xl text-[var(--ink-muted)]">
          Everything children have handed in — writing, recordings, anything
          you have asked them for. Nothing reaches them until you send it back,
          and what you write is the only thing they see.
        </p>
      </div>

      {waiting.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-10">
          <p className="font-medium">Nothing waiting.</p>
          <p className="mt-1 text-[var(--ink-muted)]">
            When a child hands something in it appears here, oldest first.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {waiting.map((w) => (
            <li key={w.id}>
              <Link
                href={`/teacher/review/${w.id}`}
                className="flex items-start gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition-colors hover:border-[var(--border-strong)]"
              >
                <span className="text-2xl" aria-hidden="true">
                  {avatarEmoji(w.avatar)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{w.childName}</span>
                    <span className="text-[var(--ink-muted)]">
                      {w.taskTitle}
                    </span>
                    <KindChip kind={w.kind} />
                  </span>
                  {w.preview && (
                    <span className="mt-0.5 block truncate text-sm text-[var(--ink-faint)]">
                      {w.preview.slice(0, 90)}
                    </span>
                  )}
                </span>
                <span
                  className={`shrink-0 text-sm ${
                    w.overdue
                      ? "text-[var(--accent-ink)]"
                      : "text-[var(--ink-faint)]"
                  }`}
                >
                  {w.waitingLabel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {released.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-wide text-[var(--ink-faint)] uppercase">
            Sent back
          </h2>
          <ul className="space-y-1 text-sm">
            {released.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/teacher/review/${r.id}`}
                  className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  {r.childName} · {r.taskTitle}
                  {r.releasedAt
                    ? ` · ${r.releasedAt.toLocaleDateString("en-GB")}`
                    : ""}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
