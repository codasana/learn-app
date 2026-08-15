/**
 * Leitner boxes — the spaced repetition behind Word Practice.
 *
 * Five boxes, doubling intervals: a word answered correctly moves up and comes
 * back later; a word missed drops to box one and comes back today. Chosen over
 * FSRS deliberately — FSRS is better at scheduling, but it needs a rating from
 * the learner ("how hard was that?") and an eight-year-old cannot give one
 * honestly. Boxes need nothing but right or wrong.
 *
 * Pure functions, no database. That is what lets the whole schedule be tested
 * against a calendar rather than by waiting a fortnight.
 */

/** Days until a word in each box comes back. Box 5 is effectively "known". */
export const BOX_INTERVALS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 8,
  5: 16,
};

export const MAX_BOX = 5;

/** A day cap, so a session stays about ten minutes for a child of eight. */
export const SESSION_SIZE = 15;

export type CardState = {
  box: number;
  dueDate: string; // yyyy-mm-dd
  correctStreak: number;
  totalReviews: number;
  totalCorrect: number;
  isMastered: boolean;
};

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(from: string, days: number): string {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

/** A word met for the first time: box one, due immediately. */
export function newCard(today: string): CardState {
  return {
    box: 1,
    dueDate: today,
    correctStreak: 0,
    totalReviews: 0,
    totalCorrect: 0,
    isMastered: false,
  };
}

/**
 * The state after one answer.
 *
 * A wrong answer sends the word back to box one and makes it due today, so it
 * returns before the child leaves — the correction is the point, and a word
 * they just missed should not disappear for a day.
 *
 * `isMastered` is additive and never comes back off, which is why it is safe
 * to show a child a count of words they know: that number can only go up. A
 * word can still be missed after mastery and will drop back through the boxes
 * to be practised again; it just stops being un-learned on a screen they see.
 */
export function review(
  current: CardState,
  wasCorrect: boolean,
  today: string,
): CardState {
  const box = wasCorrect ? Math.min(current.box + 1, MAX_BOX) : 1;

  return {
    box,
    dueDate: wasCorrect ? addDays(today, BOX_INTERVALS[box]) : today,
    correctStreak: wasCorrect ? current.correctStreak + 1 : 0,
    totalReviews: current.totalReviews + 1,
    totalCorrect: current.totalCorrect + (wasCorrect ? 1 : 0),
    // Reaching the last box is what "known" means. Never unset — see above.
    isMastered: current.isMastered || box === MAX_BOX,
  };
}

/**
 * Which cards to practise now.
 *
 * Overdue words come before new ones: a child who missed three days should
 * meet the words they were forgetting before being handed anything else. Then
 * the lowest boxes, because those are the ones they actually find hard.
 */
export function selectDue<T extends { dueDate: string; box: number }>(
  cards: T[],
  today: string,
  limit = SESSION_SIZE,
): T[] {
  return cards
    .filter((c) => c.dueDate <= today)
    .sort((a, b) => {
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
      return a.box - b.box;
    })
    .slice(0, limit);
}
