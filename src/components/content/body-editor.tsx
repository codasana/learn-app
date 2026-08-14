"use client";

import { Button } from "@/components/ui/button";
import { Field, Input, Label, Textarea } from "@/components/ui/field";
import type { Question, VocabWord } from "@/lib/content-schemas";

import { QuestionEditor } from "./question-editor";
import { move, removeAt, Row, RowList, updateAt } from "./repeatable";
import { VocabEditor } from "./vocab-editor";

type Body = Record<string, unknown>;

/**
 * Dispatches to the right editor for the content type. Every branch writes into
 * the same `body` object, so the save path never needs to know which type it is.
 */
export function BodyEditor({
  type,
  value,
  onChange,
}: {
  type: string;
  value: Body;
  onChange: (next: Body) => void;
}) {
  const patch = (p: Body) => onChange({ ...value, ...p });

  switch (type) {
    case "vocab_set":
      return (
        <VocabEditor
          value={{ words: (value.words as VocabWord[]) ?? [] }}
          onChange={(v) => patch(v)}
        />
      );

    case "passage":
      return (
        <div className="space-y-5">
          <ParagraphEditor
            value={(value.paragraphs as string[]) ?? []}
            onChange={(paragraphs) => patch({ paragraphs })}
          />
          <QuestionEditor
            value={(value.questions as Question[]) ?? []}
            onChange={(questions) => patch({ questions })}
          />
        </div>
      );

    case "quiz":
      return (
        <QuestionEditor
          value={(value.questions as Question[]) ?? []}
          onChange={(questions) => patch({ questions })}
        />
      );

    case "listening":
      return (
        <div className="space-y-5">
          <Field
            label="Script"
            hint="This becomes the audio. The child never sees it — you can."
          >
            <Textarea
              rows={8}
              value={(value.transcript as string) ?? ""}
              onChange={(e) => patch({ transcript: e.target.value })}
              placeholder="Hello! My name is Dev. I am eight years old…"
            />
          </Field>
          <QuestionEditor
            value={(value.questions as Question[]) ?? []}
            onChange={(questions) => patch({ questions })}
          />
        </div>
      );

    case "sentence_builder":
      return (
        <SentenceBuilderEditor
          value={(value.items as { correctSentence: string; tiles: string[] }[]) ?? []}
          onChange={(items) => patch({ items })}
        />
      );

    case "writing_task":
      return (
        <div className="space-y-5">
          <Field label="What you're asking them to write">
            <Textarea
              rows={3}
              value={(value.prompt as string) ?? ""}
              onChange={(e) => patch({ prompt: e.target.value })}
              placeholder="Write 3 sentences about yourself."
            />
          </Field>
          <PlanningBoxes
            value={(value.planningBoxes as string[]) ?? ["", "", ""]}
            onChange={(planningBoxes) => patch({ planningBoxes })}
          />
          <Field
            label="Model answer"
            hint="Shown after they submit, so they have something to compare against."
          >
            <Textarea
              rows={3}
              value={(value.modelAnswer as string) ?? ""}
              onChange={(e) => patch({ modelAnswer: e.target.value })}
            />
          </Field>
          <Field
            label="What to mark this week"
            hint="Keep it to one thing. It guides the feedback draft too."
          >
            <Input
              value={(value.feedbackFocus as string) ?? ""}
              onChange={(e) => patch({ feedbackFocus: e.target.value })}
              placeholder="Capital letters and full stops only"
            />
          </Field>
        </div>
      );

    case "activity":
      return (
        <Field
          label="Your notes"
          hint="Only you see this — the steps for a game, role-play or discussion."
        >
          <Textarea
            rows={8}
            value={(value.instructions as string) ?? ""}
            onChange={(e) => patch({ instructions: e.target.value })}
          />
        </Field>
      );

    // slides, worksheet, image, audio, video — the content is the uploaded file
    default:
      return (
        <div className="space-y-5">
          <Field
            label="Caption"
            hint="A short line shown with the file."
          >
            <Input
              value={(value.caption as string) ?? ""}
              onChange={(e) => patch({ caption: e.target.value })}
            />
          </Field>
          <Field label="Your notes" hint="Only you see this.">
            <Textarea
              rows={4}
              value={(value.notes as string) ?? ""}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </Field>
          <p className="rounded-[var(--radius)] bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent-ink)]">
            File upload isn&apos;t connected yet. Export slides from PowerPoint as
            a PDF and you&apos;ll be able to attach it here shortly.
          </p>
        </div>
      );
  }
}

function ParagraphEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>The passage</Label>
      <p className="text-sm text-[var(--ink-muted)]">
        One paragraph per box. The child sees them one at a time.
      </p>
      <RowList
        onAdd={() => onChange([...value, ""])}
        addLabel="Add a paragraph"
        empty="No paragraphs yet."
      >
        {value.map((p, i) => (
          <Row
            key={i}
            index={i}
            canMoveUp={i > 0}
            canMoveDown={i < value.length - 1}
            onMoveUp={() => onChange(move(value, i, i - 1))}
            onMoveDown={() => onChange(move(value, i, i + 1))}
            onRemove={() => onChange(removeAt(value, i))}
          >
            <Textarea
              rows={3}
              value={p}
              onChange={(e) => {
                const next = [...value];
                next[i] = e.target.value;
                onChange(next);
              }}
              placeholder="My name is Meera. I am eight years old."
            />
          </Row>
        ))}
      </RowList>
    </div>
  );
}

function PlanningBoxes({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Planning boxes</Label>
      <p className="text-sm text-[var(--ink-muted)]">
        Three prompts to help them plan before writing.
      </p>
      {[0, 1, 2].map((i) => (
        <Input
          key={i}
          value={value[i] ?? ""}
          onChange={(e) => {
            const next = [...value];
            next[i] = e.target.value;
            onChange(next);
          }}
          placeholder={
            ["My name and age", "My school or city", "One thing I like"][i]
          }
        />
      ))}
    </div>
  );
}

function SentenceBuilderEditor({
  value,
  onChange,
}: {
  value: { correctSentence: string; tiles: string[] }[];
  onChange: (next: { correctSentence: string; tiles: string[] }[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Sentences</Label>
      <p className="text-sm text-[var(--ink-muted)]">
        Type the correct sentence. The tiles are made from it automatically and
        shuffled for the child.
      </p>
      <RowList
        onAdd={() => onChange([...value, { correctSentence: "", tiles: [] }])}
        addLabel="Add a sentence"
        empty="No sentences yet."
      >
        {value.map((item, i) => (
          <Row
            key={i}
            index={i}
            canMoveUp={i > 0}
            canMoveDown={i < value.length - 1}
            onMoveUp={() => onChange(move(value, i, i - 1))}
            onMoveDown={() => onChange(move(value, i, i + 1))}
            onRemove={() => onChange(removeAt(value, i))}
          >
            <Input
              value={item.correctSentence}
              onChange={(e) =>
                onChange(
                  updateAt(value, i, {
                    correctSentence: e.target.value,
                    tiles: e.target.value.trim().split(/\s+/).filter(Boolean),
                  }),
                )
              }
              placeholder="My name is Meera."
            />
            {item.tiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.tiles.map((t, ti) => (
                  <span
                    key={ti}
                    className="rounded-[var(--radius-sm)] bg-[var(--primary-soft)] px-2 py-1 text-sm"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </Row>
        ))}
      </RowList>
    </div>
  );
}

export { Button };
