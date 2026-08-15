"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/field";
import { addDays, dateIn, formatInZone, shortDay } from "@/lib/time";

import { markAttendance, rescheduleClass } from "./schedule-actions";

type Klass = {
  id: string;
  startsAt: string;
  durationMin: number;
  status: string;
  meetingUrl: string | null;
};

const TIMES = [
  "07:00", "07:30", "08:00", "08:30",
  "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30",
];

/**
 * The diary for one child, and moving a class in it.
 *
 * Rescheduling is two taps — a day, then a time — because the conversation
 * already happened on WhatsApp and this is only the diary catching up. There
 * is no request, no approval, no notes field: those are ceremony around five
 * families, and the person doing the moving is the person who agreed it.
 *
 * A clash is refused rather than warned about. At eleven at night, mid
 * WhatsApp exchange, a warning is something you click past.
 */
export function ClassList({
  classes,
  teacherTimezone,
  familyTimezone,
  firstName,
}: {
  classes: Klass[];
  teacherTimezone: string;
  familyTimezone: string;
  firstName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "That did not work.");
      else setMoving(null);
      router.refresh();
    });
  }

  if (classes.length === 0) {
    return (
      <p className="text-[var(--ink-muted)]">
        No classes in the diary yet. Set the slot above and fill it.
      </p>
    );
  }

  const differentZone = familyTimezone !== teacherTimezone;

  return (
    <div className="space-y-3">
      {error ? <Notice>{error}</Notice> : null}

      <ul className="space-y-2">
        {classes.map((c) => {
          const at = new Date(c.startsAt);
          const isMoving = moving === c.id;

          return (
            <li
              key={c.id}
              className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">
                    {formatInZone(at, teacherTimezone, {
                      weekday: true,
                      date: true,
                    })}
                  </span>
                  {differentZone && (
                    <span className="block text-sm text-[var(--ink-faint)]">
                      {formatInZone(at, familyTimezone)} for the family
                    </span>
                  )}
                </span>

                <Button
                  variant="quiet"
                  disabled={pending}
                  onClick={() => setMoving(isMoving ? null : c.id)}
                >
                  {isMoving ? "Keep it" : "Move"}
                </Button>
              </div>

              {isMoving && (
                <MoveControls
                  teacherTimezone={teacherTimezone}
                  pending={pending}
                  onPick={(date, time) =>
                    run(() => rescheduleClass(c.id, date, time))
                  }
                />
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-[var(--ink-faint)]">
        Moving a class here only changes the diary. Telling {firstName}&rsquo;s
        family is still a message from you.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Fourteen days, then a time. Two taps, no calendar widget. */
function MoveControls({
  teacherTimezone,
  pending,
  onPick,
}: {
  teacherTimezone: string;
  pending: boolean;
  onPick: (date: string, time: string) => void;
}) {
  const today = dateIn(teacherTimezone, new Date());
  const [date, setDate] = useState<string | null>(null);

  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  return (
    <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
      <div>
        <p className="text-sm font-medium">Move to</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {dates.map((d) => {
            const on = d === date;
            const day = new Date(`${d}T12:00:00Z`).getUTCDay();
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setDate(d)}
                className={`min-h-11 rounded-[var(--radius)] border-2 px-2.5 text-sm transition-colors ${
                  on
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--ink-on-primary)]"
                    : "border-[var(--border)] hover:bg-[var(--surface-sunken)]"
                }`}
              >
                <span className="block text-[0.7rem] opacity-70">
                  {shortDay(day)}
                </span>
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
      </div>

      {date && (
        <div>
          <p className="text-sm font-medium">At</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-8">
            {TIMES.map((t) => (
              <button
                key={t}
                type="button"
                disabled={pending}
                onClick={() => onPick(date, t)}
                className="min-h-11 rounded-[var(--radius)] border-2 border-[var(--border)] text-sm transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] disabled:opacity-40"
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-[var(--ink-faint)]">
            A time that clashes with another child will be refused.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Present, absent, or it did not happen. Three buttons, no menu. */
export function AttendanceButtons({
  scheduledClassId,
  current,
  onDone,
}: {
  scheduledClassId: string;
  current: string | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const options = [
    { value: "present", label: "Came", tone: "var(--panel-mint)" },
    { value: "absent", label: "Missed", tone: "var(--panel-peach)" },
    { value: "cancelled", label: "Called off", tone: "var(--panel-butter)" },
  ] as const;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={pending}
            aria-pressed={on}
            onClick={() =>
              start(async () => {
                await markAttendance(scheduledClassId, o.value);
                onDone?.();
                router.refresh();
              })
            }
            className={`min-h-[var(--tap-target)] rounded-[var(--radius-lg)] border-2 px-5 font-medium transition-colors disabled:opacity-50 ${
              on
                ? "border-[var(--ink)] text-[var(--ink)]"
                : "border-transparent text-[var(--ink-muted)] hover:border-[var(--border-strong)]"
            }`}
            style={{ background: on ? o.tone : "var(--surface-sunken)" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
