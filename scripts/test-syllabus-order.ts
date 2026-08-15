/**
 * Exercises week reordering against the real database, then cleans up after
 * itself. Nothing it creates survives a successful run.
 *
 *   npx tsx scripts/test-syllabus-order.ts
 *
 * Worth having as a script rather than a unit test: the tricky part is the
 * unique constraint on (syllabus_id, week_number), which only Postgres can
 * tell us about.
 */
import { config } from "dotenv";
import { asc, eq } from "drizzle-orm";

config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db");
  const { syllabi, syllabusUnits } = await import("../src/db/schema");
  const { deleteUnitAndClose, findUnit, reorderList, swapUnitWithNeighbour } =
    await import("../src/lib/syllabus-order");

  let failures = 0;
  const check = (label: string, actual: unknown, expected: unknown) => {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    const ok = a === e;
    if (!ok) failures++;
    console.log(`${ok ? "  ok  " : "FAIL  "}${label}${ok ? "" : `\n        got ${a}\n        want ${e}`}`);
  };

  const [syllabus] = await db
    .insert(syllabi)
    .values({ name: "__test__ ordering" })
    .returning({ id: syllabi.id });

  try {
    await db.insert(syllabusUnits).values(
      Array.from({ length: 5 }, (_, i) => ({
        syllabusId: syllabus.id,
        position: i + 1,
        theme: `Theme ${i + 1}`,
      })),
    );

    const themes = async () => {
      const rows = await db
        .select({ theme: syllabusUnits.theme })
        .from(syllabusUnits)
        .where(eq(syllabusUnits.syllabusId, syllabus.id))
        .orderBy(asc(syllabusUnits.position));
      return rows.map((r) => r.theme);
    };
    const weekAt = async (n: number) => {
      const rows = await db
        .select()
        .from(syllabusUnits)
        .where(eq(syllabusUnits.syllabusId, syllabus.id))
        .orderBy(asc(syllabusUnits.position));
      return rows[n - 1];
    };

    check("five weeks in order", await themes(), [
      "Theme 1",
      "Theme 2",
      "Theme 3",
      "Theme 4",
      "Theme 5",
    ]);

    // The move the model exists for: week 5 up to week 3.
    await swapUnitWithNeighbour((await weekAt(5))!, "up");
    await swapUnitWithNeighbour((await weekAt(4))!, "up");
    check("week 5 moved up twice, and the theme travelled with it", await themes(), [
      "Theme 1",
      "Theme 2",
      "Theme 5",
      "Theme 3",
      "Theme 4",
    ]);

    const top = (await weekAt(1))!;
    check(
      "moving the top week up does nothing",
      await swapUnitWithNeighbour(top, "up"),
      false,
    );
    check("order unchanged after the no-op", await themes(), [
      "Theme 1",
      "Theme 2",
      "Theme 5",
      "Theme 3",
      "Theme 4",
    ]);

    // Delete from the middle; the gap must close.
    await deleteUnitAndClose((await weekAt(3))!);
    check("deleting week 3 closes the gap", await themes(), [
      "Theme 1",
      "Theme 2",
      "Theme 3",
      "Theme 4",
    ]);

    const numbers = await db
      .select({ n: syllabusUnits.position })
      .from(syllabusUnits)
      .where(eq(syllabusUnits.syllabusId, syllabus.id))
      .orderBy(asc(syllabusUnits.position));
    check(
      "numbering is still 1..n with no holes",
      numbers.map((r) => r.n),
      [1, 2, 3, 4],
    );

    // Deleting the last week needs no renumbering at all.
    await deleteUnitAndClose((await weekAt(4))!);
    check("deleting the last week", await themes(), [
      "Theme 1",
      "Theme 2",
      "Theme 3",
    ]);

    // The generic list reorder, used for materials and practice items.
    const seen: Record<string, number> = {};
    await reorderList(["a", "b", "c"], "c", "up", async (id, i) => {
      seen[id] = i;
    });
    check("reorderList moves c above b", seen, { a: 0, c: 1, b: 2 });
    check(
      "reorderList refuses to move past the end",
      await reorderList(["a", "b"], "b", "down", async () => {}),
      false,
    );

    // A week whose id is gone.
    check(
      "findUnit on a deleted week",
      await findUnit("00000000-0000-0000-0000-000000000000"),
      undefined,
    );
  } finally {
    await db.delete(syllabi).where(eq(syllabi.id, syllabus.id));
    console.log("\ncleaned up the test syllabus");
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("all checks passed");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
