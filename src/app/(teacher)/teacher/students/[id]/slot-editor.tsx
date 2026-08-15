"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input, Notice } from "@/components/ui/field";
import { formatInZone, shortDay, wallTimeToInstant } from "@/lib/time";

import { generateClasses, saveSlot } from "./schedule-actions";

/**
 * Setting a child's weekly slot, by pressing things.
 *
 * Built like a till rather than a form: every choice is a button that is
 * either on or off, the whole state is visible without scrolling, and the only
 * typing is the meeting link, which is a paste. Setting up five families
 * should be five minutes of tapping, not five forms.
 *
 * The panel underneath is the point of the whole screen — it says what the
 * family will see in their own timezone, before anything is saved. Getting
 * that wrong is the single most expensive mistake here, and it is invisible
 * until a child sits alone in a meeting.
 */

const TIMES = [
  "07:00", "07:30", "08:00", "08:30",
  "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30",
];

const DURATIONS = [30, 45, 60];

export function SlotEditor({
  childId,
  firstName,
  teacherTimezone,
  familyTimezone,
  slot,
}: {
  childId: string;
  firstName: string;
  teacherTimezone: string;
  familyTimezone: string;
  slot: {
    days: number[];
    time: string | null;
    durationMin: number;
    meetingUrl: string | null;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [days, setDays] = useState<number[]>(slot.days);
  const [time, setTime] = useState<string>(slot.time ?? "17:00");
  const [durationMin, setDuration] = useState(slot.durationMin);
  const [meetingUrl, setMeetingUrl] = useState(slot.meetingUrl ?? "");

  const dirty =
    JSON.stringify([...days].sort()) !== JSON.stringify([...slot.days].sort()) ||
    time !== (slot.time ?? "17:00") ||
    durationMin !== slot.durationMin ||
    meetingUrl !== (slot.meetingUrl ?? "");

  function toggleDay(d: number) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string; note?: string }>) {
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "That did not work.");
      else setMessage(res.note ?? "Saved.");
      router.refresh();
    });
  }

  // A real instant, so the family's time accounts for their DST rather than a
  // fixed offset. The date is arbitrary; only the clock reading matters.
  const sample = wallTimeToInstant("2026-12-07", time, teacherTimezone);
  const differentZone = familyTimezone !== teacherTimezone;

  return (
    <section className="space-y-5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div>
        <h2 className="font-medium">When {firstName} has class</h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Set once. It repeats every week until you change it.
        </p>
      </div>

      {error ? <Notice>{error}</Notice> : null}
      {message ? (
        <p className="rounded-[var(--radius)] bg-[var(--correct-soft)] px-4 py-2 text-sm text-[var(--correct)]">
          {message}
        </p>
      ) : null}

      {/* --- days ------------------------------------------------- */}
      <div>
        <p className="text-sm font-medium">Days</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(d)}
                className={`min-h-[var(--tap-target)] min-w-[4.25rem] rounded-[var(--radius-lg)] border-2 text-base font-medium transition-colors ${
                  on
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--ink-on-primary)]"
                    : "border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-sunken)]"
                }`}
              >
                {shortDay(d)}
              </button>
            );
          })}
        </div>
      </div>

      {/* --- time --------------------------------------------------- */}
      <div>
        <p className="text-sm font-medium">
          Time{" "}
          <span className="font-normal text-[var(--ink-faint)]">
            · your clock
          </span>
        </p>
        <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {TIMES.map((t) => {
            const on = t === time;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => setTime(t)}
                className={`min-h-[var(--tap-target)] rounded-[var(--radius)] border-2 text-sm font-medium transition-colors ${
                  on
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--ink-on-primary)]"
                    : "border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-sunken)]"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* --- how long ----------------------------------------------- */}
      <div>
        <p className="text-sm font-medium">How long</p>
        <div className="mt-2 flex gap-2">
          {DURATIONS.map((d) => {
            const on = d === durationMin;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setDuration(d)}
                className={`min-h-[var(--tap-target)] min-w-20 rounded-[var(--radius-lg)] border-2 text-base font-medium transition-colors ${
                  on
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--ink-on-primary)]"
                    : "border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-sunken)]"
                }`}
              >
                {d} min
              </button>
            );
          })}
        </div>
      </div>

      {/* --- what it means ------------------------------------------ */}
      <div className="rounded-[var(--radius-card)] bg-[var(--panel-lilac)] p-4">
        {days.length === 0 ? (
          <p className="text-[var(--ink-muted)]">Pick a day to see the time.</p>
        ) : (
          <>
            <p className="text-lg font-bold">
              {days.map(shortDay).join(" & ")} · {formatInZone(sample, teacherTimezone)}
            </p>
            <p className="text-sm text-[var(--ink-muted)]">
              {days.length} class{days.length === 1 ? "" : "es"} a week, {durationMin} minutes each
            </p>
            {differentZone && (
              <p className="mt-2 text-[var(--accent-ink)]">
                {firstName}&rsquo;s family sees{" "}
                <strong>{formatInZone(sample, familyTimezone)}</strong> in{" "}
                {familyTimezone.split("/")[1]?.replace("_", " ")}
              </p>
            )}
          </>
        )}
      </div>

      {/* --- the one thing that has to be typed --------------------- */}
      <div>
        <p className="text-sm font-medium">Meeting link</p>
        <p className="text-sm text-[var(--ink-muted)]">
          One Google Meet link for {firstName}, used every week. Paste it once.
        </p>
        <Input
          className="mt-2"
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          placeholder="https://meet.google.com/abc-defg-hij"
          inputMode="url"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          disabled={pending || !dirty || days.length === 0}
          onClick={() =>
            run(() =>
              saveSlot(childId, {
                days,
                time,
                durationMin,
                timezone: teacherTimezone,
                meetingUrl,
              }),
            )
          }
        >
          {pending ? "Saving…" : "Save the slot"}
        </Button>

        <Button
          variant="secondary"
          disabled={pending || dirty || days.length === 0}
          onClick={() => run(() => generateClasses(childId, 12))}
          title={dirty ? "Save the slot first" : undefined}
        >
          Put 12 weeks in the diary
        </Button>
      </div>

      {dirty && days.length > 0 && (
        <p className="text-sm text-[var(--ink-faint)]">
          Save the slot before filling the diary.
        </p>
      )}
    </section>
  );
}
