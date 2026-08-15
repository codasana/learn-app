/**
 * One-off: take the position out of content already in the database.
 *
 * The seed used to stamp every piece with a "week 1" tag and put "Week 1" in
 * three titles. Both claim a position for something meant to be reusable —
 * the same passage can serve unit 1 for one child and unit 4 for another, and
 * a unit can be skipped entirely. Tags describe what a thing IS.
 *
 * Fixing the seed only helps a fresh database; this fixes the rows that exist.
 * Safe to run twice.
 */
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

/** "week 1", "Unit 3", "week1" — anything that is a position, not a subject. */
const POSITION_TAG = /^(week|unit)\s*\d+$/i;

const RETITLE: Record<string, string> = {
  "Week 1 words — All About Me": "All About Me — words",
  "Week 1 sentence builder": "All About Me — sentence builder",
  "Week 1 quiz — All About Me": "All About Me — quiz",
};

/*
 * Every piece carried the same three tags, so filtering by tag returned
 * everything and the tag column was thirteen identical rows. Tags only earn
 * their place when they separate things.
 *
 * These describe theme and grammar — what the piece is ABOUT. The kind
 * (passage, word list, quiz) is already its own column, so repeating it here
 * would just be the type twice.
 */
const TAGS: Record<string, string[]> = {
  "All About Me — words": ["all about me", "introductions"],
  "Meet Meera": ["all about me", "introductions", "school"],
  "What makes a sentence": ["sentences", "capital letters", "full stops"],
  "“Be Meera!” role-play": ["introductions", "speaking aloud"],
  "Writing planner: three boxes": ["planning", "all about me"],
  "“Three things about me” game": [
    "introductions",
    "i am / i have / i like",
  ],
  "Capitals and full stops practice": ["capital letters", "full stops"],
  "Arjun and His Bicycle": ["hobbies", "family"],
  "Zara's New School": ["school", "feelings"],
  "Dev introduces himself": ["introductions", "listening"],
  "All About Me — sentence builder": [
    "i am / i have / i like",
    "sentences",
  ],
  "Three sentences about yourself": ["introductions", "i am / i have / i like"],
  "All About Me — quiz": ["all about me"],
};

async function main() {
  const { db } = await import("../src/db");
  const { contentItems } = await import("../src/db/schema");

  const rows = await db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      tags: contentItems.tags,
    })
    .from(contentItems);

  let tagged = 0;
  let retitled = 0;

  for (const row of rows) {
    const newTitle = RETITLE[row.title];
    const title = newTitle ?? row.title;

    // Prefer the hand-written set; otherwise just drop the position tag.
    const kept =
      TAGS[title] ?? row.tags.filter((t) => !POSITION_TAG.test(t.trim()));

    const patch: { tags?: string[]; title?: string } = {};
    if (kept.join("|") !== row.tags.join("|")) {
      patch.tags = kept;
      tagged++;
      console.log(`  tags   ${title}`);
      console.log(`         [${row.tags.join(", ")}] → [${kept.join(", ")}]`);
    }
    if (newTitle) {
      patch.title = newTitle;
      retitled++;
      console.log(`  title  ${row.title} → ${newTitle}`);
    }

    if (Object.keys(patch).length > 0) {
      await db.update(contentItems).set(patch).where(eq(contentItems.id, row.id));
    }
  }

  console.log(
    `\n${rows.length} items · ${tagged} retagged · ${retitled} renamed`,
  );
  process.exit(0);
}

main();
