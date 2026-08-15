/**
 * Walks a word through a calendar and checks it comes back when it should.
 *
 *   npx tsx scripts/test-leitner.ts
 *
 * No database. The whole point of keeping the schedule in pure functions is
 * that a fortnight of spaced repetition can be tested in a millisecond rather
 * than by waiting a fortnight.
 */
import {
  addDays,
  BOX_INTERVALS,
  MAX_BOX,
  newCard,
  review,
  selectDue,
  SESSION_SIZE,
} from "../src/lib/leitner";

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

const DAY1 = "2026-12-01";

/* --- a word answered right every time climbs and slows down --------- */
{
  let card = newCard(DAY1);
  let today = DAY1;
  const schedule: string[] = [];

  for (let i = 0; i < 5; i++) {
    card = review(card, true, today);
    schedule.push(`box ${card.box} → due ${card.dueDate}`);
    today = card.dueDate;
  }

  check("five correct answers walk it up the boxes", schedule, [
    "box 2 → due 2026-12-03",
    "box 3 → due 2026-12-07",
    "box 4 → due 2026-12-15",
    "box 5 → due 2026-12-31",
    "box 5 → due 2027-01-16",
  ]);
  check("it is marked known at the top box", card.isMastered, true);
  check("box never exceeds the maximum", card.box, MAX_BOX);
  check("every review is counted", card.totalReviews, 5);
}

/* --- a word missed comes straight back ------------------------------ */
{
  let card = newCard(DAY1);
  card = review(card, true, DAY1); // box 2
  card = review(card, true, "2026-12-03"); // box 3
  const before = card.box;
  card = review(card, false, "2026-12-07");

  check("a miss drops it to box one", { before, after: card.box }, { before: 3, after: 1 });
  check("and makes it due the same day", card.dueDate, "2026-12-07");
  check("the streak resets", card.correctStreak, 0);
  check("but the history is kept", card.totalReviews, 3);
}

/* --- mastery is additive -------------------------------------------- */
{
  let card = newCard(DAY1);
  let today = DAY1;
  for (let i = 0; i < 4; i++) {
    card = review(card, true, today);
    today = card.dueDate;
  }
  check("known after four correct", card.isMastered, true);

  card = review(card, false, today);
  check("still known after later missing it", card.isMastered, true);
  check("but back in box one to practise", card.box, 1);
}

/* --- what a session picks up ---------------------------------------- */
{
  const cards = [
    { id: "overdue-3d", dueDate: "2026-11-28", box: 4 },
    { id: "overdue-1d", dueDate: "2026-11-30", box: 2 },
    { id: "due-today-hard", dueDate: DAY1, box: 1 },
    { id: "due-today-easy", dueDate: DAY1, box: 4 },
    { id: "not-yet", dueDate: "2026-12-05", box: 3 },
  ];

  check(
    "the most overdue comes first, then the hardest",
    selectDue(cards, DAY1).map((c) => c.id),
    ["overdue-3d", "overdue-1d", "due-today-hard", "due-today-easy"],
  );
  check(
    "a word not due yet is left alone",
    selectDue(cards, DAY1).some((c) => c.id === "not-yet"),
    false,
  );
}

/* --- a child who disappears for a month ----------------------------- */
{
  const many = Array.from({ length: 40 }, (_, i) => ({
    id: `w${i}`,
    dueDate: addDays(DAY1, -30 + (i % 5)),
    box: (i % 5) + 1,
  }));

  const session = selectDue(many, DAY1);
  check("a session stays a session, not a punishment", session.length, SESSION_SIZE);
  check(
    "and starts with the longest forgotten",
    session[0].dueDate,
    addDays(DAY1, -30),
  );
}

/* --- the intervals themselves --------------------------------------- */
check("intervals double", Object.values(BOX_INTERVALS), [1, 2, 4, 8, 16]);
check("a word met today is due today", newCard(DAY1).dueDate, DAY1);
check("date maths crosses a month end", addDays("2026-12-31", 1), "2027-01-01");
check("and a leap day", addDays("2028-02-28", 1), "2028-02-29");

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
