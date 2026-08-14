"use client";

import { useState } from "react";

import { Input, Label, Textarea } from "@/components/ui/field";
import type { VocabWord } from "@/lib/content-schemas";

import { move, removeAt, Row, RowList, updateAt } from "./repeatable";

const blankWord: VocabWord = {
  word: "",
  meaning: "",
  exampleSentence: "",
  imageUrl: null,
  audioUrl: null,
  distractorMeanings: [],
};

/**
 * Word list editor.
 *
 * Note there is no "picture" field per word here beyond an optional URL: most
 * Level 1 vocabulary cannot be pictured at all (together, before, kind, work),
 * which is why review is meaning-based and pictures only enrich concrete nouns.
 */
export function VocabEditor({
  value,
  onChange,
}: {
  value: { words: VocabWord[] };
  onChange: (next: { words: VocabWord[] }) => void;
}) {
  const words = value.words ?? [];
  const [bulk, setBulk] = useState("");

  function set(words: VocabWord[]) {
    onChange({ words });
  }

  /**
   * Paste a whole week's list at once. This is how a teacher actually works —
   * she has the list in a document already, and typing 18 words into 18 forms
   * is the thing that would stop her using this.
   */
  function importBulk() {
    const rows = bulk
      .split("\n")
      .map((line) => line.split("\t").length > 1 ? line.split("\t") : line.split("|"))
      .map((cells) => cells.map((c) => c.trim()))
      .filter((cells) => cells[0]);

    if (rows.length === 0) return;

    set([
      ...words,
      ...rows.map((cells) => ({
        ...blankWord,
        word: cells[0] ?? "",
        meaning: cells[1] ?? "",
        exampleSentence: cells[2] ?? "",
      })),
    ]);
    setBulk("");
  }

  return (
    <div className="space-y-5">
      <RowList
        onAdd={() => set([...words, { ...blankWord }])}
        addLabel="Add a word"
        empty="No words yet. Add them one at a time, or paste your whole list below."
      >
        {words.map((w, i) => (
          <Row
            key={i}
            index={i}
            canMoveUp={i > 0}
            canMoveDown={i < words.length - 1}
            onMoveUp={() => set(move(words, i, i - 1))}
            onMoveDown={() => set(move(words, i, i + 1))}
            onRemove={() => set(removeAt(words, i))}
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr]">
              <div className="space-y-1">
                <Label>Word</Label>
                <Input
                  value={w.word}
                  onChange={(e) =>
                    set(updateAt(words, i, { word: e.target.value }))
                  }
                  placeholder="friend"
                />
              </div>
              <div className="space-y-1">
                <Label>What it means, in child words</Label>
                <Input
                  value={w.meaning}
                  onChange={(e) =>
                    set(updateAt(words, i, { meaning: e.target.value }))
                  }
                  placeholder="a person you like to play with"
                />
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <Label>Example sentence</Label>
              <Input
                value={w.exampleSentence}
                onChange={(e) =>
                  set(updateAt(words, i, { exampleSentence: e.target.value }))
                }
                placeholder="Sara is my best friend."
              />
            </div>
          </Row>
        ))}
      </RowList>

      <details className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-sunken)] p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Paste a whole list at once
        </summary>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          One word per line, with the meaning and example separated by a tab or a
          vertical bar. Copying straight from a document or spreadsheet works.
        </p>
        <Textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={6}
          className="mt-2 font-mono text-sm"
          placeholder={"friend | a person you like to play with | Sara is my best friend.\nfamily | the people you live with and love | I love my family."}
        />
        <button
          type="button"
          onClick={importBulk}
          className="mt-2 rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
        >
          Add these words
        </button>
      </details>

      <p className="text-sm text-[var(--ink-faint)]">
        {words.length} word{words.length === 1 ? "" : "s"} · a week usually has
        15–20
      </p>
    </div>
  );
}
