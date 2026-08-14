"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import type { Question } from "@/lib/content-schemas";

import { move, removeAt, Row, RowList, updateAt } from "./repeatable";

export const blankQuestion: Question = {
  prompt: "",
  options: ["", "", ""],
  correctIndex: 0,
};

/**
 * Multiple-choice question editor, shared by passages, listening clips and
 * quizzes. The correct answer is picked with a radio, so it is impossible to
 * save a question with no right answer marked.
 */
export function QuestionEditor({
  value,
  onChange,
  label = "Questions",
}: {
  value: Question[];
  onChange: (next: Question[]) => void;
  label?: string;
}) {
  const questions = value ?? [];

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <RowList
        onAdd={() => onChange([...questions, { ...blankQuestion, options: ["", "", ""] }])}
        addLabel="Add a question"
        empty="No questions yet."
      >
        {questions.map((q, qi) => (
          <Row
            key={qi}
            index={qi}
            canMoveUp={qi > 0}
            canMoveDown={qi < questions.length - 1}
            onMoveUp={() => onChange(move(questions, qi, qi - 1))}
            onMoveDown={() => onChange(move(questions, qi, qi + 1))}
            onRemove={() => onChange(removeAt(questions, qi))}
          >
            <div className="space-y-1">
              <Label>Question</Label>
              <Input
                value={q.prompt}
                onChange={(e) =>
                  onChange(updateAt(questions, qi, { prompt: e.target.value }))
                }
                placeholder="How old is Meera?"
              />
            </div>

            <div className="mt-3 space-y-2">
              <Label>Answers — tick the right one</Label>
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${label}-${qi}`}
                    checked={q.correctIndex === oi}
                    onChange={() =>
                      onChange(updateAt(questions, qi, { correctIndex: oi }))
                    }
                    aria-label={`Mark answer ${oi + 1} as correct`}
                    className="h-5 w-5 accent-[var(--primary)]"
                  />
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const options = [...q.options];
                      options[oi] = e.target.value;
                      onChange(updateAt(questions, qi, { options }));
                    }}
                    placeholder={`Answer ${oi + 1}`}
                  />
                  <button
                    type="button"
                    aria-label={`Remove answer ${oi + 1}`}
                    onClick={() => {
                      const options = q.options.filter((_, i) => i !== oi);
                      const correctIndex =
                        q.correctIndex >= options.length
                          ? Math.max(0, options.length - 1)
                          : q.correctIndex;
                      onChange(updateAt(questions, qi, { options, correctIndex }));
                    }}
                    disabled={q.options.length <= 2}
                    className="rounded px-2 py-1 text-sm text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {q.options.length < 4 && (
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() =>
                    onChange(
                      updateAt(questions, qi, { options: [...q.options, ""] }),
                    )
                  }
                >
                  Add another answer
                </Button>
              )}
            </div>
          </Row>
        ))}
      </RowList>
    </div>
  );
}
