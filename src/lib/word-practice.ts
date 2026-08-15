import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { cardStates } from "@/db/schema";
import { vocabSetBody, type VocabWord } from "@/lib/content-schemas";
import {
  isoDate,
  newCard,
  review,
  selectDue,
  SESSION_SIZE,
} from "@/lib/leitner";

/**
 * Word Practice — turning a week's word lists into a daily session.
 *
 * The review format is word → meaning, not word → picture. About a third of
 * Level 1 vocabulary has no sensible picture at all — *together*, *before*,
 * *kind*, *work* — so a picture-first design would silently drop the words
 * children most need help with. Pictures can decorate; meaning is the test.
 *
 * Wrong answers are drawn from the other words in the same list, at answer
 * time rather than at authoring time. That way they stay correct when the
 * teacher edits the list, and they are plausible by construction: sibling
 * words from one week are exactly the ones a child confuses.
 */

/** How a word is identified across weeks, syllabuses and levels. */
export function wordKey(word: string): string {
  return word.trim().toLowerCase();
}

export type PracticeCard = {
  wordKey: string;
  word: string;
  meaning: string;
  exampleSentence: string;
  /** Three wrong meanings plus the right one, already shuffled. */
  options: string[];
  correctIndex: number;
  box: number;
};

type VocabItem = { id: string; body: unknown };

/** Every word in this week's lists, keyed for lookup. */
export function wordsFrom(items: VocabItem[]): Map<
  string,
  VocabWord & { sourceItemId: string }
> {
  const all = new Map<string, VocabWord & { sourceItemId: string }>();

  for (const item of items) {
    const parsed = vocabSetBody.safeParse(item.body);
    if (!parsed.success) continue;

    for (const w of parsed.data.words) {
      if (!w.word.trim() || !w.meaning.trim()) continue;
      all.set(wordKey(w.word), { ...w, sourceItemId: item.id });
    }
  }
  return all;
}

/**
 * Makes sure every word in this week has a card, then returns today's session.
 *
 * Cards are created on first sight rather than at enrolment, so a teacher who
 * edits a word list next Tuesday does not leave a child holding rows for words
 * that no longer exist.
 */
export async function todaysSession(
  childId: string,
  vocabItems: VocabItem[],
  today = isoDate(new Date()),
): Promise<PracticeCard[]> {
  const words = wordsFrom(vocabItems);
  if (words.size === 0) return [];

  const keys = [...words.keys()];

  const existing = await db
    .select()
    .from(cardStates)
    .where(
      and(eq(cardStates.childId, childId), inArray(cardStates.wordKey, keys)),
    );

  const missing = keys.filter((k) => !existing.some((e) => e.wordKey === k));
  if (missing.length > 0) {
    const fresh = newCard(today);
    await db
      .insert(cardStates)
      .values(
        missing.map((k) => ({
          childId,
          wordKey: k,
          sourceItemId: words.get(k)!.sourceItemId,
          box: fresh.box,
          dueDate: fresh.dueDate,
        })),
      )
      // A double-tap on "start" must not blow up on the unique constraint.
      .onConflictDoNothing();
  }

  const all = await db
    .select()
    .from(cardStates)
    .where(
      and(eq(cardStates.childId, childId), inArray(cardStates.wordKey, keys)),
    );

  const due = selectDue(all, today);

  return due.map((card) => {
    const w = words.get(card.wordKey)!;
    return {
      wordKey: card.wordKey,
      word: w.word,
      meaning: w.meaning,
      exampleSentence: w.exampleSentence,
      box: card.box,
      ...buildOptions(w, words),
    };
  });
}

/**
 * Three plausible wrong meanings and the right one.
 *
 * Falls back to fewer options rather than inventing filler when a list is very
 * short — two real choices beat four with padding in them.
 */
function buildOptions(
  target: VocabWord,
  all: Map<string, VocabWord & { sourceItemId: string }>,
): { options: string[]; correctIndex: number } {
  const authored = target.distractorMeanings.filter((m) => m.trim());

  const siblings = [...all.values()]
    .filter(
      (w) =>
        wordKey(w.word) !== wordKey(target.word) &&
        w.meaning.trim() &&
        w.meaning !== target.meaning,
    )
    .map((w) => w.meaning);

  const pool = [...new Set([...authored, ...shuffle(siblings)])].slice(0, 3);
  const options = shuffle([target.meaning, ...pool]);

  return { options, correctIndex: options.indexOf(target.meaning) };
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * How many words are waiting, without creating anything.
 *
 * Today's screen needs this before the child has opened Word Practice, and at
 * that point most of their cards do not exist yet — they are created on first
 * sight. Counting only existing cards would tell a child with a fresh week
 * that they have nothing to do, which is the opposite of true.
 */
export async function dueCount(
  childId: string,
  vocabItems: VocabItem[],
  today = isoDate(new Date()),
): Promise<number> {
  const words = wordsFrom(vocabItems);
  if (words.size === 0) return 0;

  const keys = [...words.keys()];
  const existing = await db
    .select({ wordKey: cardStates.wordKey, dueDate: cardStates.dueDate, box: cardStates.box })
    .from(cardStates)
    .where(
      and(eq(cardStates.childId, childId), inArray(cardStates.wordKey, keys)),
    );

  const unseen = keys.filter((k) => !existing.some((e) => e.wordKey === k));
  const due = selectDue(existing, today, Number.MAX_SAFE_INTEGER).length;

  return Math.min(due + unseen.length, SESSION_SIZE);
}

/**
 * Records one answer.
 *
 * The client sends only the word and whether it was right; the new box and due
 * date are computed here. A child's device never gets to say when a word
 * should come back.
 */
export async function recordAnswer(
  childId: string,
  key: string,
  wasCorrect: boolean,
  today = isoDate(new Date()),
): Promise<void> {
  const card = await db.query.cardStates.findFirst({
    where: and(eq(cardStates.childId, childId), eq(cardStates.wordKey, key)),
  });
  if (!card) return;

  const next = review(
    {
      box: card.box,
      dueDate: card.dueDate,
      correctStreak: card.correctStreak,
      totalReviews: card.totalReviews,
      totalCorrect: card.totalCorrect,
      isMastered: card.isMastered,
    },
    wasCorrect,
    today,
  );

  await db
    .update(cardStates)
    .set({ ...next, lastReviewedAt: new Date() })
    .where(eq(cardStates.id, card.id));
}

/** How many words this child now knows. Only ever goes up. */
export async function wordsKnown(childId: string): Promise<number> {
  const rows = await db
    .select({ id: cardStates.id })
    .from(cardStates)
    .where(
      and(eq(cardStates.childId, childId), eq(cardStates.isMastered, true)),
    );
  return rows.length;
}
