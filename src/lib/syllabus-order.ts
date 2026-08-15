/**
 * Unit renumbering.
 *
 * Reordering units is the operation the whole content model exists to make
 * cheap — a teacher who decides in November that unit five belongs at unit
 * three should get that in one click, with everything inside the unit coming
 * along. So this lives apart from the server actions: no auth, no revalidation,
 * nothing but the ordering, which means it can be tested on its own.
 *
 * `(syllabus_id, week_number)` is unique, which is what makes these fiddly —
 * a naive UPDATE collides with itself halfway through. Both functions dodge
 * that by parking rows in numbers no real unit can hold: zero, and negatives.
 */

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { syllabusUnits } from "@/db/schema";

export type UnitRow = typeof syllabusUnits.$inferSelect;

export async function findUnit(unitId: string): Promise<UnitRow | undefined> {
  return db.query.syllabusUnits.findFirst({
    where: eq(syllabusUnits.id, unitId),
  });
}

/**
 * Swaps a unit with the one above or below it. Returns false when there is no
 * neighbour — the unit is already at the top or the bottom.
 */
export async function swapUnitWithNeighbour(
  unit: UnitRow,
  direction: "up" | "down",
): Promise<boolean> {
  const targetNumber = unit.position + (direction === "up" ? -1 : 1);

  const neighbour = await db.query.syllabusUnits.findFirst({
    where: and(
      eq(syllabusUnits.syllabusId, unit.syllabusId),
      eq(syllabusUnits.position, targetNumber),
    ),
  });
  if (!neighbour) return false;

  await db.transaction(async (tx) => {
    // Park at 0 so the neighbour can take this unit's old number.
    await tx
      .update(syllabusUnits)
      .set({ position: 0 })
      .where(eq(syllabusUnits.id, unit.id));
    await tx
      .update(syllabusUnits)
      .set({ position: unit.position })
      .where(eq(syllabusUnits.id, neighbour.id));
    await tx
      .update(syllabusUnits)
      .set({ position: targetNumber })
      .where(eq(syllabusUnits.id, unit.id));
  });

  return true;
}

/**
 * Deletes a unit and closes the gap, so numbering stays 1..n with no holes.
 *
 * Two passes: everything above the gap goes negative at its new number, then
 * comes back positive. One pass would collide with the rows it has not moved
 * yet.
 */
export async function deleteUnitAndClose(unit: UnitRow): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(syllabusUnits).where(eq(syllabusUnits.id, unit.id));

    await tx
      .update(syllabusUnits)
      .set({ position: sql`-(${syllabusUnits.position} - 1)` })
      .where(
        and(
          eq(syllabusUnits.syllabusId, unit.syllabusId),
          sql`${syllabusUnits.position} > ${unit.position}`,
        ),
      );

    await tx
      .update(syllabusUnits)
      .set({ position: sql`-${syllabusUnits.position}` })
      .where(
        and(
          eq(syllabusUnits.syllabusId, unit.syllabusId),
          sql`${syllabusUnits.position} < 0`,
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
