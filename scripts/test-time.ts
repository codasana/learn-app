/**
 * Timezone maths, walked through real DST transitions.
 *
 *   npx tsx scripts/test-time.ts
 *
 * Pure functions, no database, no network. Every case below is a real date on
 * a real calendar, chosen because it is a place this normally breaks: the
 * clocks changing in London and New York, a zone with a half-hour offset, and
 * the fact that India and the Gulf never change at all.
 *
 * The scenario underneath all of it: Sheeba teaches at 5pm her time, every
 * week. What time is that for a family in London — and does it stay the same
 * number of o'clock for them in March?
 */
import {
  addDays,
  dateIn,
  formatInZone,
  offsetMinutes,
  partsIn,
  wallTimeToInstant,
} from "../src/lib/time";

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(
    `${ok ? "  ok  " : "FAIL  "}${label}${ok ? "" : `\n        got ${a}\n        want ${e}`}`,
  );
};

/* --- offsets, including the awkward ones -------------------------- */

const midwinter = new Date("2026-12-15T12:00:00Z");
check("India is +5:30", offsetMinutes("Asia/Kolkata", midwinter), 330);
check("Dubai is +4", offsetMinutes("Asia/Dubai", midwinter), 240);
check("London in December is +0", offsetMinutes("Europe/London", midwinter), 0);

const midsummer = new Date("2026-07-15T12:00:00Z");
check("London in July is +1", offsetMinutes("Europe/London", midsummer), 60);
check(
  "India does not move in July",
  offsetMinutes("Asia/Kolkata", midsummer),
  330,
);

/* --- a class at 5pm India, seen from elsewhere -------------------- */

const classAt5 = wallTimeToInstant("2026-12-07", "17:00", "Asia/Kolkata");
check("5pm in India is 11:30 UTC", classAt5.toISOString(), "2026-12-07T11:30:00.000Z");
check(
  "the same moment is 3:30pm in Dubai",
  formatInZone(classAt5, "Asia/Dubai"),
  "3:30pm",
);
check(
  "and 11:30am in London",
  formatInZone(classAt5, "Europe/London"),
  "11:30am",
);
// India is +5:30 and Singapore +8, so the gap is two and a HALF hours. Worth
// stating: half-hour offsets are exactly where mental arithmetic goes wrong,
// and this expectation was wrong the first time it was written.
check(
  "and 7:30pm in Singapore",
  formatInZone(classAt5, "Asia/Singapore"),
  "7:30pm",
);

/* --- the part that catches people ---------------------------------
 * India has no daylight saving. So a slot fixed at 5pm India stays at the
 * same instant all year, and it is the LONDON family whose clock moves. A
 * parent in London joins at 11:30 in winter and 12:30 in summer, and that is
 * correct — the class did not move, their clocks did.
 * ------------------------------------------------------------------ */

const sameSlotInSummer = wallTimeToInstant("2026-07-06", "17:00", "Asia/Kolkata");
check(
  "the slot is still 11:30 UTC in July",
  sameSlotInSummer.toISOString(),
  "2026-07-06T11:30:00.000Z",
);
check(
  "so London sees 12:30pm in summer, not 11:30",
  formatInZone(sameSlotInSummer, "Europe/London"),
  "12:30pm",
);
check(
  "while Dubai sees 3:30pm all year",
  formatInZone(sameSlotInSummer, "Asia/Dubai"),
  "3:30pm",
);

/* --- a slot defined in a zone that DOES change -------------------- */

// If a slot were ever pinned to London time, the instant must move with the
// clocks. 29 March 2026 is when the UK springs forward.
const beforeUkChange = wallTimeToInstant("2026-03-28", "17:00", "Europe/London");
const afterUkChange = wallTimeToInstant("2026-03-30", "17:00", "Europe/London");
check(
  "5pm London before the change is 17:00 UTC",
  beforeUkChange.toISOString(),
  "2026-03-28T17:00:00.000Z",
);
check(
  "5pm London after the change is 16:00 UTC",
  afterUkChange.toISOString(),
  "2026-03-30T16:00:00.000Z",
);

/* --- reading an instant back ---------------------------------------- */

check(
  "the wall clock in Dubai reads back",
  partsIn("Asia/Dubai", classAt5),
  { date: "2026-12-07", time: "15:30", weekday: 1 },
);
check(
  "and in India, where it was set",
  partsIn("Asia/Kolkata", classAt5),
  { date: "2026-12-07", time: "17:00", weekday: 1 },
);

/* --- a class that falls on a different DATE for the family --------- */

// 9pm in India on Monday is already Tuesday in Sydney.
const lateClass = wallTimeToInstant("2026-12-07", "21:00", "Asia/Kolkata");
check(
  "Monday night in India is Tuesday in Sydney",
  partsIn("Australia/Sydney", lateClass).weekday,
  2,
);
check(
  "and the family's date is a day ahead",
  dateIn("Australia/Sydney", lateClass),
  "2026-12-08",
);

/* --- midnight, which is where hour-24 bugs live -------------------- */

const midnight = wallTimeToInstant("2026-12-07", "00:00", "Asia/Kolkata");
check(
  "midnight stays midnight, not 24:00",
  partsIn("Asia/Kolkata", midnight).time,
  "00:00",
);

/* --- plain date arithmetic ----------------------------------------- */

check("a week later", addDays("2026-12-07", 7), "2026-12-14");
check("across a month end", addDays("2026-12-28", 7), "2027-01-04");
check("across a leap day", addDays("2028-02-27", 2), "2028-02-29");

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
