"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { completeActivity } from "./actions";

type Item = { correctSentence: string; tiles: string[] };

/**
 * Sentence Builder — tap words in order to make a sentence.
 *
 * Tapping rather than dragging, deliberately. Drag-and-drop is fiddly on a
 * tablet, unusable with a trackpad, and impossible with a keyboard; a tap is
 * none of those things and an eight-year-old never has to be taught it.
 *
 * A wrong order is not marked wrong. The child taps a word to take it back and
 * tries again, and only checks when they are ready — the skill is word order,
 * and being told "no" mid-thought teaches nothing about word order.
 *
 * Tiles arrive already shuffled from the server. Shuffling here would render
 * one order into the HTML and a different one after hydration.
 */
export function SentencePlayer({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: Item[];
}) {
  const [index, setIndex] = useState(0);
  const [built, setBuilt] = useState<string[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const item = items[index];

  if (!item) return null;

  const tiles = item.tiles;

  function place(tileId: string) {
    if (checked !== null) return;
    setBuilt((b) => [...b, tileId]);
  }

  function takeBack(tileId: string) {
    if (checked !== null) return;
    setBuilt((b) => b.filter((t) => t !== tileId));
  }

  function check() {
    const sentence = built.map((t) => t.split(":").slice(1).join(":")).join(" ");
    const target = item.correctSentence.replace(/\s+/g, " ").trim();
    // Punctuation and capitals are the teacher's job in class, not a gotcha here.
    const ok = normalise(sentence) === normalise(target);
    setChecked(ok);
    if (ok) setCorrect((c) => c + 1);
  }

  async function next() {
    if (index + 1 >= items.length) {
      setSaving(true);
      await completeActivity(id, {
        kind: "sentence_builder",
        score: correct,
        total: items.length,
      });
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
    setBuilt([]);
    setChecked(null);
  }

  if (done) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-6xl" aria-hidden="true">
          {correct === items.length ? "🎉" : "👍"}
        </p>
        <h1 className="mt-4 text-3xl font-bold">Finished</h1>
        <p className="mt-3 text-lg text-[var(--ink-muted)]">
          {correct} out of {items.length} sentences.
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
    <main className="mx-auto w-full max-w-md flex-1 px-6 pt-4 pb-10">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-[var(--ink-muted)]">
        Sentence {index + 1} of {items.length}. Tap the words in order.
      </p>

      {/* What they have built so far. */}
      <div
        className={`mt-6 flex min-h-24 flex-wrap content-start gap-2 rounded-[var(--radius-card)] border-2 p-4 ${
          checked === true
            ? "border-[var(--correct)] bg-[var(--correct-soft)]"
            : checked === false
              ? "border-[var(--notyet)] bg-[var(--notyet-soft)]"
              : "border-dashed border-[var(--border-strong)] bg-[var(--surface)]"
        }`}
      >
        {built.length === 0 && (
          <p className="text-[var(--ink-faint)]">Your sentence goes here</p>
        )}
        {built.map((tileId) => (
          <button
            key={tileId}
            type="button"
            onClick={() => takeBack(tileId)}
            className="min-h-[var(--tap-target)] rounded-[var(--radius)] bg-[var(--primary)] px-4 text-lg text-[var(--ink-on-primary)]"
          >
            {tileId.split(":").slice(1).join(":")}
          </button>
        ))}
      </div>

      {/* The words still to use. */}
      <div className="mt-6 flex flex-wrap gap-2">
        {tiles.map((tile, i) => {
          const tileId = `${i}:${tile}`;
          if (built.includes(tileId)) return null;
          return (
            <button
              key={tileId}
              type="button"
              onClick={() => place(tileId)}
              className="min-h-[var(--tap-target)] rounded-[var(--radius)] border-2 border-[var(--border-strong)] bg-[var(--surface)] px-4 text-lg hover:bg-[var(--surface-sunken)]"
            >
              {tile}
            </button>
          );
        })}
      </div>

      <div className="mt-8 space-y-3">
        {checked === null ? (
          <Button size="lg" disabled={built.length === 0} onClick={check}>
            Check it
          </Button>
        ) : (
          <>
            <p className="text-lg font-medium">
              {checked ? "That's it!" : "Not yet — it goes like this:"}
            </p>
            {!checked && (
              <p className="text-lg text-[var(--ink-muted)]">
                {item.correctSentence}
              </p>
            )}
            <Button size="lg" disabled={saving} onClick={next}>
              {saving
                ? "Saving…"
                : index + 1 >= items.length
                  ? "Finish"
                  : "Next sentence"}
            </Button>
          </>
        )}
      </div>
    </main>
  );
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
