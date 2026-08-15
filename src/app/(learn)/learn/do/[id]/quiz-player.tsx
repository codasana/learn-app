"use client";

import { QuestionRun, type Question } from "./question-run";

/** The end-of-week quiz. Same machinery as a passage, without the passage. */
export function QuizPlayer({
  id,
  title,
  questions,
}: {
  id: string;
  title: string;
  questions: Question[];
}) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 pt-4 pb-10">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-[var(--ink-muted)]">
        A few questions about this week. Take your time.
      </p>
      <QuestionRun id={id} kind="quiz" questions={questions} />
    </main>
  );
}
