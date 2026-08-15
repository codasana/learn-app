"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { completeActivity } from "./actions";

export type Question = {
  prompt: string;
  options: string[];
  correctIndex: number;
};

/**
 * A run of multiple-choice questions, shared by passages, quizzes and
 * listening.
 *
 * Same three rules as Word Practice, for the same reason — an eight-year-old
 * is doing this alone at the kitchen table:
 *
 *  - nothing is red; a miss is amber and says "not yet"
 *  - a miss always reveals the right answer before moving on
 *  - the run ends, and the end screen is warm regardless of the score
 *
 * The score is reported once at the end rather than per answer, so a child who
 * closes the tab halfway has simply not finished — no half-completions to
 * explain to a parent.
 */
export function QuestionRun({
  id,
  kind,
  questions,
  intro,
  onDoneHref = "/learn",
}: {
  id: string;
  kind: "reading" | "quiz" | "listening";
  questions: Question[];
  /** Rendered above the questions — the passage, or the listening script. */
  intro?: React.ReactNode;
  onDoneHref?: string;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const answered = Object.keys(answers).length;
  const score = questions.reduce(
    (n, q, i) => n + (answers[i] === q.correctIndex ? 1 : 0),
    0,
  );

  async function finish() {
    setSaving(true);
    await completeActivity(id, { kind, score, total: questions.length });
    setSaving(false);
    setDone(true);
  }

  if (done) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-6xl" aria-hidden="true">
          {score === questions.length ? "🎉" : "👍"}
        </p>
        <h1 className="mt-4 text-3xl font-bold">
          {score === questions.length ? "All right!" : "Nice work"}
        </h1>
        <p className="mt-3 text-lg text-[var(--ink-muted)]">
          You got {score} out of {questions.length}.
        </p>
        <div className="mt-10 w-full">
          <Button asChild size="lg">
            <Link href={onDoneHref}>Back to today</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <>
      {intro}

      <ol className="mt-8 space-y-8">
        {questions.map((q, qi) => {
          const chosen = answers[qi];
          const reveal = chosen !== undefined;

          return (
            <li key={qi}>
              <p className="text-lg font-medium">{q.prompt}</p>
              <div className="mt-3 space-y-2">
                {q.options.map((option, oi) => {
                  const isRight = oi === q.correctIndex;
                  let tone =
                    "bg-[var(--surface)] border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]";
                  if (reveal && isRight) {
                    tone =
                      "bg-[var(--correct-soft)] border-[var(--correct)]";
                  } else if (reveal && chosen === oi) {
                    tone = "bg-[var(--notyet-soft)] border-[var(--notyet)]";
                  } else if (reveal) {
                    tone =
                      "bg-[var(--surface)] border-[var(--border)] opacity-60";
                  }

                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={reveal}
                      onClick={() =>
                        setAnswers((a) => ({ ...a, [qi]: oi }))
                      }
                      className={`min-h-[var(--tap-target)] w-full rounded-[var(--radius-lg)] border-2 px-5 py-3 text-left text-lg transition-colors disabled:cursor-default ${tone}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {reveal && chosen !== q.correctIndex && (
                <p className="mt-2 text-[var(--accent-ink)]">
                  Not yet — it&rsquo;s the green one.
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-10">
        <Button
          size="lg"
          disabled={answered < questions.length || saving}
          onClick={finish}
        >
          {saving
            ? "Saving…"
            : answered < questions.length
              ? `${questions.length - answered} left`
              : "I'm finished"}
        </Button>
      </div>
    </>
  );
}
