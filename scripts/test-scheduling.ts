/**
 * Generating a term of classes, and refusing to double-book.
 *
 *   npx tsx scripts/test-scheduling.ts
 *
 * Pure functions on a real calendar. The cases are the ones that actually
 * happen to a teacher with five families across four timezones: two lessons a
 * week that are not evenly spaced, a term that crosses a clock change, and the
 * moment she tries to put two children in the same half hour.
 */
import { conflicts, firstConflict, occurrences } from "../src/lib/scheduling";
import { formatInZone, partsIn } from "../src/lib/time";

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

const IST = "Asia/Kolkata";

/* --- Monday and Thursday, 5pm, for a fortnight -------------------- */
{
  const slot = { days: [1, 4], time: "17:00", timezone: IST, durationMin: 45 };
  const list = occurrences(slot, "2026-12-01", "2026-12-14");

  check("two a week for two weeks is four classes", list.length, 4);
  check(
    "on the right days, in the right order",
    list.map((c) => partsIn(IST, c.startsAt).date),
    ["2026-12-03", "2026-12-07", "2026-12-10", "2026-12-14"],
  );
  check(
    "all at five in the afternoon",
    [...new Set(list.map((c) => partsIn(IST, c.startsAt).time))],
    ["17:00"],
  );
}

/* --- one class a week, because that is what this family bought ---- */
{
  const slot = { days: [6], time: "10:30", timezone: IST, durationMin: 45 };
  const list = occurrences(slot, "2026-12-01", "2026-12-31");
  check("Saturdays only", list.length, 4);
  check(
    "and all on a Saturday",
    [...new Set(list.map((c) => partsIn(IST, c.startsAt).weekday))],
    [6],
  );
}

/* --- across the UK clock change ------------------------------------
 * The slot is 5pm India, which never moves. A London family therefore sees
 * the class jump an hour when their clocks go forward — the class is at the
 * same instant, their morning is not.
 * ------------------------------------------------------------------ */
{
  const slot = { days: [1], time: "17:00", timezone: IST, durationMin: 45 };
  const list = occurrences(slot, "2026-03-23", "2026-04-06");

  check(
    "the India time never changes",
    [...new Set(list.map((c) => partsIn(IST, c.startsAt).time))],
    ["17:00"],
  );
  check(
    "but London sees it move when their clocks do",
    list.map((c) => formatInZone(c.startsAt, "Europe/London")),
    ["11:30am", "12:30pm", "12:30pm"],
  );
}

/* --- collisions ---------------------------------------------------- */
{
  const at = (iso: string, mins = 45) => ({
    startsAt: new Date(iso),
    durationMin: mins,
  });

  const diary = [
    { id: "nila", ...at("2026-12-07T11:30:00Z") }, // 5:00–5:45pm IST
  ];

  check(
    "the same time is a collision",
    conflicts(at("2026-12-07T11:30:00Z"), diary).map((c) => c.id),
    ["nila"],
  );
  check(
    "overlapping by ten minutes is a collision",
    conflicts(at("2026-12-07T12:05:00Z"), diary).map((c) => c.id),
    ["nila"],
  );
  check(
    "starting exactly when the other ends is FINE",
    conflicts(at("2026-12-07T12:15:00Z"), diary).length,
    0,
  );
  check(
    "ending exactly when the other starts is FINE",
    conflicts(at("2026-12-07T10:45:00Z"), diary).length,
    0,
  );
  check(
    "a different day is fine",
    conflicts(at("2026-12-08T11:30:00Z"), diary).length,
    0,
  );
  check(
    "moving a class does not collide with itself",
    conflicts(at("2026-12-07T11:30:00Z"), diary, "nila").length,
    0,
  );
  check(
    "a longer class can swallow a shorter one",
    conflicts(at("2026-12-07T11:00:00Z", 120), diary).map((c) => c.id),
    ["nila"],
  );
}

/* --- generating a term into a diary that already has children ------ */
{
  const slot = { days: [1, 4], time: "17:00", timezone: IST, durationMin: 45 };
  const planned = occurrences(slot, "2026-12-01", "2026-12-14");

  const clash = firstConflict(planned, [
    // Another child already at 5pm on the 10th.
    { id: "arjun", startsAt: new Date("2026-12-10T11:30:00Z"), durationMin: 45 },
  ]);
  check(
    "a term that walks into an existing class is caught",
    clash?.against.id ?? null,
    "arjun",
  );
  check(
    "and it names the date it happens",
    clash ? partsIn(IST, clash.at).date : null,
    "2026-12-10",
  );

  check(
    "a clear diary generates cleanly",
    firstConflict(planned, [
      { id: "arjun", startsAt: new Date("2026-12-10T13:00:00Z"), durationMin: 45 },
    ]),
    null,
  );
}

/* --- a slot with two classes on the same day ----------------------- */
{
  // Two children can share a weekday; the slot itself must not duplicate one.
  const slot = { days: [1, 1], time: "17:00", timezone: IST, durationMin: 45 };
  const list = occurrences(slot, "2026-12-01", "2026-12-07");
  check("a repeated weekday does not double up", list.length, 1);
}

/* --- nothing set yet ------------------------------------------------ */
check(
  "no days means no classes",
  occurrences({ days: [], time: "17:00", timezone: IST, durationMin: 45 }, "2026-12-01", "2026-12-31").length,
  0,
);
check(
  "no time means no classes",
  occurrences({ days: [1], time: "", timezone: IST, durationMin: 45 }, "2026-12-01", "2026-12-31").length,
  0,
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
