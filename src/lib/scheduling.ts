import { addDays, partsIn, wallTimeToInstant } from "@/lib/time";

/**
 * Turning a recurring slot into actual classes, and spotting collisions.
 *
 * Pure: no database, no clock of its own. Everything is passed in, so
 * scripts/test-scheduling can put a term on a calendar and check what comes
 * out rather than waiting for December.
 */

export type Slot = {
  /** 0 = Sunday. */
  days: number[];
  /** "17:00", wall clock in `timezone`. */
  time: string;
  timezone: string;
  durationMin: number;
};

export type PlannedClass = {
  startsAt: Date;
  durationMin: number;
};

/**
 * Every occurrence of a slot between two dates, inclusive of `from`.
 *
 * Walks days rather than adding weeks, because a slot on more than one weekday
 * is not a weekly interval — Monday and Thursday are three days apart, then
 * four. Walking is also the only way to stay right across a DST change, since
 * "the same wall-clock time" is a different number of hours later.
 */
export function occurrences(
  slot: Slot,
  from: string,
  to: string,
): PlannedClass[] {
  if (slot.days.length === 0 || !slot.time) return [];

  const out: PlannedClass[] = [];
  let date = from;
  let guard = 0;

  while (date <= to && guard++ < 400) {
    const at = wallTimeToInstant(date, slot.time, slot.timezone);
    // The weekday is read back in the slot's own zone: "Monday 5pm in India"
    // is a Monday there even when it is still Sunday somewhere else.
    const { weekday } = partsIn(slot.timezone, at);

    if (slot.days.includes(weekday)) {
      out.push({ startsAt: at, durationMin: slot.durationMin });
    }
    date = addDays(date, 1);
  }

  return out;
}

export type Busy = {
  id: string;
  startsAt: Date;
  durationMin: number;
};

/**
 * Anything already in the diary that would overlap.
 *
 * Half-open intervals, so back-to-back is fine: a 45-minute class at 5:00 and
 * another at 5:45 do not collide. Touching is not overlapping, and with a
 * teacher running consecutive lessons that distinction is the difference
 * between a usable diary and a permanently blocked one.
 */
export function conflicts(
  candidate: PlannedClass,
  existing: Busy[],
  ignoreId?: string,
): Busy[] {
  const start = candidate.startsAt.getTime();
  const end = start + candidate.durationMin * 60_000;

  return existing.filter((e) => {
    if (ignoreId && e.id === ignoreId) return false;
    const eStart = e.startsAt.getTime();
    const eEnd = eStart + e.durationMin * 60_000;
    return start < eEnd && eStart < end;
  });
}

/** Which of a planned set collide with the diary, or with each other. */
export function firstConflict(
  planned: PlannedClass[],
  existing: Busy[],
): { at: Date; against: Busy } | null {
  const running: Busy[] = [...existing];

  for (const p of planned) {
    const hit = conflicts(p, running);
    if (hit.length > 0) return { at: p.startsAt, against: hit[0] };
    running.push({
      id: `planned-${p.startsAt.toISOString()}`,
      startsAt: p.startsAt,
      durationMin: p.durationMin,
    });
  }
  return null;
}
