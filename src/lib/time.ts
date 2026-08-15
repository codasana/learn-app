/**
 * Wall-clock time in a named zone, converted to and from absolute instants.
 *
 * The whole programme turns on this being right. A class is agreed as "five
 * o'clock on a Monday" in somebody's local time; the database stores an
 * instant; and three people in three countries each need to be told a
 * different number of o'clock for the same moment. Get it wrong and a child
 * sits alone in a meeting.
 *
 * No dependency. `Intl` already knows every zone's offset at every instant,
 * including the historical and future DST rules, and it is in Node. The trick
 * below — format the instant *as if* in the target zone, read it back as UTC,
 * and the difference is the offset — is the standard way to get at it.
 *
 * Everything here is pure, so scripts/test-time can walk it through real DST
 * transitions rather than hoping.
 */

/** Minutes that `tz` is ahead of UTC at this instant. */
export function offsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  // Intl renders hour 24 for midnight in some locales; normalise it.
  const hour = get("hour") % 24;

  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );

  return (asIfUtc - at.getTime()) / 60_000;
}

/**
 * "2026-12-01" + "17:00" in Asia/Dubai → the instant that is.
 *
 * Resolved twice because the offset depends on the instant we are still
 * working out: the first guess can land on the wrong side of a DST change, and
 * the second pass corrects it. Only relevant for zones that observe DST, which
 * is exactly where this would otherwise be wrong twice a year.
 */
export function wallTimeToInstant(
  date: string,
  time: string,
  tz: string,
): Date {
  const naive = Date.parse(`${date}T${time}:00Z`);
  if (Number.isNaN(naive)) {
    throw new Error(`Not a date and time: "${date}" "${time}"`);
  }

  const firstGuess = new Date(naive - offsetMinutes(tz, new Date(naive)) * 60_000);
  const refined = new Date(
    naive - offsetMinutes(tz, firstGuess) * 60_000,
  );
  return refined;
}

/** The wall-clock parts of an instant, in a zone. */
export function partsIn(
  tz: string,
  at: Date,
): { date: string; time: string; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(at);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hour = String(Number(get("hour")) % 24).padStart(2, "0");

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
    weekday: days.indexOf(get("weekday")),
  };
}

/** "Mon 5:00 pm" — for a person, in their own zone. */
export function formatInZone(
  at: Date,
  tz: string,
  opts: { weekday?: boolean; date?: boolean } = {},
): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...(opts.weekday ? { weekday: "short" as const } : {}),
    ...(opts.date ? { day: "numeric" as const, month: "short" as const } : {}),
  })
    .format(at)
    .replace(" am", "am")
    .replace(" pm", "pm");
}

/** 0 = Sunday, matching JS and the `slot_days` column. */
export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function shortDay(day: number): string {
  return WEEKDAYS[day]?.slice(0, 3) ?? "?";
}

/** yyyy-mm-dd for an instant, in a zone. */
export function dateIn(tz: string, at: Date): string {
  return partsIn(tz, at).date;
}

/** Adds days to a yyyy-mm-dd string without touching timezones. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
