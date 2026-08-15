"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { answer, finishWords } from "./actions";

type Card = {
  wordKey: string;
  word: string;
  meaning: string;
  exampleSentence: string;
  options: string[];
  correctIndex: number;
  box: number;
};

/**
 * One word at a time.
 *
 * Three rules the design follows, all of them about an eight-year-old rather
 * than about correctness:
 *
 *  - **Nothing is red.** A wrong answer is amber and says "not yet" — the
 *    palette has no red token at all. A child practising alone should never
 *    meet the colour of failure.
 *  - **A wrong answer always shows the right one**, then moves on by itself.
 *    Being stuck on a wrong answer is where children give up.
 *  - **The session ends.** It is a fixed short list with an end screen, not an
 *    infinite feed. Ten minutes was the promise made to the parent.
 */
export function WordSession({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  const card = cards[index];

  async function choose(option: number) {
    if (chosen !== null) return;

    const wasCorrect = option === card.correctIndex;
    setChosen(option);
    if (wasCorrect) setCorrect((c) => c + 1);

    void answer(card.wordKey, wasCorrect);

    // Long enough to read the right answer, short enough not to feel stuck.
    setTimeout(
      () => {
        if (index + 1 >= cards.length) {
          void finishWords().then(() => router.refresh());
          setDone(true);
        } else {
          setIndex((i) => i + 1);
          setChosen(null);
        }
      },
      wasCorrect ? 700 : 1800,
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-6xl" aria-hidden="true">
          🎉
        </p>
        <h1 className="mt-4 text-3xl font-bold">All done</h1>
        <p className="mt-3 text-lg text-[var(--ink-muted)]">
          You got {correct} out of {cards.length} right.
        </p>
        <p className="mt-2 text-[var(--ink-muted)]">
          The tricky ones will come back tomorrow.
        </p>
        <div className="mt-10 w-full">
          <Button asChild size="lg">
            <Link href="/learn">Back to today</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10">
      <div
        className="h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={cards.length}
        aria-label={`Word ${index + 1} of ${cards.length}`}
      >
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300"
          style={{ width: `${((index + 1) / cards.length) * 100}%` }}
        />
      </div>

      <div className="mt-10 text-center">
        <p className="text-sm text-[var(--ink-faint)]">What does this mean?</p>
        <p className="mt-2 text-4xl font-bold">{card.word}</p>
      </div>

      <div className="mt-8 space-y-3">
        {card.options.map((option, i) => {
          const isChosen = chosen === i;
          const isRight = i === card.correctIndex;
          const reveal = chosen !== null;

          let tone =
            "bg-[var(--surface)] border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]";
          if (reveal && isRight) {
            tone = "bg-[var(--correct-soft)] border-[var(--correct)]";
          } else if (reveal && isChosen) {
            // Amber, never red. See the note above.
            tone = "bg-[var(--notyet-soft)] border-[var(--notyet)]";
          } else if (reveal) {
            tone = "bg-[var(--surface)] border-[var(--border)] opacity-60";
          }

          return (
            <button
              key={option}
              type="button"
              disabled={reveal}
              onClick={() => choose(i)}
              className={`min-h-[var(--tap-target)] w-full rounded-[var(--radius-lg)] border-2 px-5 py-4 text-left text-lg transition-colors disabled:cursor-default ${tone}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {chosen !== null && (
        <div className="mt-6 text-center">
          <p className="text-lg font-medium">
            {chosen === card.correctIndex ? "Yes!" : "Not yet — it's this one"}
          </p>
          {card.exampleSentence && (
            <p className="mt-2 text-[var(--ink-muted)]">
              {card.exampleSentence}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
