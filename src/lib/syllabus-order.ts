/**
 * Week renumbering.
 *
 * Reordering weeks is the operation the whole content model exists to make
 * cheap — a teacher who decides in November that week five belongs at week
 * three should get that in one click, with everything inside the week coming
 * along. So this lives apart from the server actions: no auth, no revalidation,
 * nothing but the ordering, which means it can be tested on its own.
 *
 * `(syllabus_id, week_number)` is unique, which is what makes these fiddly —
 * a naive UPDATE collides with itself halfway through. Both functions dodge
 * that by parking rows in numbers no real week can hold: zero, and negatives.
 */

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { syllabusWeeks } from "@/db/schema";

export type WeekRow = typeof syllabusWeeks.$inferSelect;

export async function findWeek(weekId: string): Promise<WeekRow | undefined> {
  return db.query.syllabusWeeks.findFirst({
    where: eq(syllabusWeeks.id, weekId),
  });
}

/**
 * Swaps a week with the one above or below it. Returns false when there is no
 * neighbour — the week is already at the top or the bottom.
 */
export async function swapWeekWithNeighbour(
  week: WeekRow,
  direction: "up" | "down",
): Promise<boolean> {
  const targetNumber = week.weekNumber + (direction === "up" ? -1 : 1);

  const neighbour = await db.query.syllabusWeeks.findFirst({
    where: and(
      eq(syllabusWeeks.syllabusId, week.syllabusId),
      eq(syllabusWeeks.weekNumber, targetNumber),
    ),
  });
  if (!neighbour) return false;

  await db.transaction(async (tx) => {
    // Park at 0 so the neighbour can take this week's old number.
    await tx
      .update(syllabusWeeks)
      .set({ weekNumber: 0 })
      .where(eq(syllabusWeeks.id, week.id));
    await tx
      .update(syllabusWeeks)
      .set({ weekNumber: week.weekNumber })
      .where(eq(syllabusWeeks.id, neighbour.id));
    await tx
      .update(syllabusWeeks)
      .set({ weekNumber: targetNumber })
      .where(eq(syllabusWeeks.id, week.id));
  });

  return true;
}

/**
 * Deletes a week and closes the gap, so numbering stays 1..n with no holes.
 *
 * Two passes: everything above the gap goes negative at its new number, then
 * comes back positive. One pass would collide with the rows it has not moved
 * yet.
 */
export async function deleteWeekAndClose(week: WeekRow): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(syllabusWeeks).where(eq(syllabusWeeks.id, week.id));

    await tx
      .update(syllabusWeeks)
      .set({ weekNumber: sql`-(${syllabusWeeks.weekNumber} - 1)` })
      .where(
        and(
          eq(syllabusWeeks.syllabusId, week.syllabusId),
          sql`${syllabusWeeks.weekNumber} > ${week.weekNumber}`,
        ),
      );

    await tx
      .update(syllabusWeeks)
      .set({ weekNumber: sql`-${syllabusWeeks.weekNumber}` })
      .where(
        and(
          eq(syllabusWeeks.syllabusId, week.syllabusId),
          sql`${syllabusWeeks.weekNumber} < 0`,
        ),
      );
  });
}

/**
 * Moves one id up or down a list and rewrites every sort_order as its new
 * index. Rewriting the whole list rather than swapping two values keeps the
 * ordering dense and self-healing: duplicate or missing sort_order values left
 * by any earlier bug quietly correct themselves on the next move.
 */
export async function reorderList(
  ids: string[],
  moving: string,
  direction: "up" | "down",
  write: (id: string, sortOrder: number) => Promise<void>,
): Promise<boolean> {
  const from = ids.indexOf(moving);
  if (from === -1) return false;

  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return false;

  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];

  await Promise.all(next.map((id, i) => write(id, i)));
  return true;
}
