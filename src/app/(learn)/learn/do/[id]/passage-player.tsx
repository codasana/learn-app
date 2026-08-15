"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { completeActivity } from "./actions";
import { QuestionRun, type Question } from "./question-run";

/**
 * A passage, then questions about it.
 *
 * The passage stays on screen while the questions are answered. Hiding it
 * would test memory; the skill being practised is reading for meaning, and a
 * child looking back at the text to check is doing exactly the right thing.
 */
export function PassagePlayer({
  id,
  title,
  paragraphs,
  questions,
}: {
  id: string;
  title: string;
  paragraphs: string[];
  questions: Question[];
}) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 pt-4 pb-10">
      <h1 className="text-2xl font-bold">{title}</h1>

      <article className="mt-5 space-y-4 rounded-[var(--radius-card)] bg-[var(--surface)] p-6 text-lg leading-relaxed">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>

      {questions.length === 0 ? (
        <MarkRead id={id} />
      ) : (
        <QuestionRun id={id} kind="reading" questions={questions} />
      )}
    </main>
  );
}

/**
 * Some passages carry no questions — the ones a teacher hands over before a
 * class, to be talked about live. Reading it is still the work, so finishing
 * still counts and still shows as done on Today.
 */
function MarkRead({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  if (done) {
    return (
      <div className="mt-8 text-center">
        <p className="text-lg font-medium">Nice reading.</p>
        <div className="mt-4">
          <Button asChild size="lg">
            <Link href="/learn">Back to today</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <Button
        size="lg"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          await completeActivity(id, { kind: "reading", score: 1, total: 1 });
          setDone(true);
        }}
      >
        {saving ? "Saving…" : "I've read it"}
      </Button>
    </div>
  );
}
