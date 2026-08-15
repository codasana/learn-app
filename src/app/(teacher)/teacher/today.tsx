"use client";

import Link from "next/link";

import { avatarEmoji } from "@/lib/avatars";
import { formatInZone } from "@/lib/time";

import { AttendanceButtons } from "./students/[id]/class-list";

type Klass = {
  id: string;
  startsAt: string;
  durationMin: number;
  status: string;
  attended: string | null;
  meetingUrl: string | null;
  childId: string;
  firstName: string;
  avatar: string;
  unitLabel: string;
  unitPosition: number;
  unitTheme: string | null;
  unitOverridden: boolean;
};

/**
 * Her evening, as a row of cards.
 *
 * Big enough to use on a phone with one hand between classes: the time, who it
 * is, what they are on, a Join button, and the three attendance buttons all
 * visible without opening anything. Nothing here is a link to somewhere else
 * that then has the button on it.
 */
export function Today({
  classes,
  timezone,
}: {
  classes: Klass[];
  timezone: string;
}) {
  if (classes.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-8">
        <p className="font-medium">Nothing today.</p>
        <p className="mt-1 text-[var(--ink-muted)]">
          Classes appear here on the day, in your own time.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {classes.map((c) => {
        const done = Boolean(c.attended);
        return (
          <li
            key={c.id}
            className={`rounded-[var(--radius-card)] border p-4 transition-colors ${
              done
                ? "border-[var(--border)] bg-[var(--surface-sunken)]"
                : "border-[var(--border-strong)] bg-[var(--surface)]"
            }`}
          >
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-20">
                <p className="text-2xl font-bold tabular-nums">
                  {formatInZone(new Date(c.startsAt), timezone)}
                </p>
                <p className="text-sm text-[var(--ink-faint)]">
                  {c.durationMin} min
                </p>
              </div>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-lg font-bold">
                  <span aria-hidden="true">{avatarEmoji(c.avatar)}</span>
                  <Link
                    href={`/teacher/students/${c.childId}`}
                    className="hover:underline"
                  >
                    {c.firstName}
                  </Link>
                </p>
                <p className="text-[var(--ink-muted)]">
                  {c.unitTheme ?? `${c.unitLabel} ${c.unitPosition}`}
                  {c.unitOverridden && (
                    <span className="text-[var(--ink-faint)]"> · set for this class</span>
                  )}
                </p>
              </div>

              {c.meetingUrl && !done && (
                <a
                  href={c.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-lg)] bg-[var(--primary)] px-6 font-medium text-[var(--ink-on-primary)] hover:bg-[var(--primary-hover)]"
                >
                  Join
                </a>
              )}
            </div>

            <div className="mt-4">
              <AttendanceButtons
                scheduledClassId={c.id}
                current={c.attended}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
