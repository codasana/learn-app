"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/field";

import { type UnitLabel, unitName } from "@/lib/unit-label";

import {
  addUnit,
  deleteUnit,
  moveUnit,
  setSyllabusStatus,
} from "../actions";

export type BoardUnit = {
  id: string;
  position: number;
  theme: string;
  grammarFocus: string | null;
  selfStudy: number;
  classMaterials: number;
};

export function Board({
  syllabusId,
  status,
  units,
  label,
}: {
  syllabusId: string;
  status: "draft" | "published";
  units: BoardUnit[];
  /** What this syllabus calls its chunks. Never hardcode "Week" here. */
  label: UnitLabel;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string } | void>) {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok && result.error) setMessage(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {message ? <Notice>{message}</Notice> : null}

      <ol className="space-y-2">
        {units.map((w, i) => (
          <li
            key={w.id}
            className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
          >
            <span className="w-20 shrink-0 text-sm text-[var(--ink-faint)]">
              {unitName(label, w.position)}
            </span>

            <Link href={`/teacher/syllabus/${syllabusId}/unit/${w.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {w.theme || (
                  <span className="text-[var(--ink-faint)] italic">
                    No theme yet
                  </span>
                )}
              </p>
              <p className="truncate text-sm text-[var(--ink-muted)]">
                {w.grammarFocus ? `${w.grammarFocus} · ` : ""}
                {w.classMaterials} in class · {w.selfStudy} to practise
              </p>
            </Link>

            <div className="flex shrink-0 items-center gap-1">
              <MoveButton
                label="Move up"
                glyph="↑"
                disabled={pending || i === 0}
                onClick={() => run(() => moveUnit(w.id, "up"))}
              />
              <MoveButton
                label="Move down"
                glyph="↓"
                disabled={pending || i === units.length - 1}
                onClick={() => run(() => moveUnit(w.id, "down"))}
              />
              <RemoveUnit
                name={unitName(label, w.position)}
                empty={w.selfStudy + w.classMaterials === 0}
                disabled={pending}
                onConfirm={() => run(() => deleteUnit(w.id))}
              />
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => addUnit(syllabusId))}
        >
          Add {label.unitLabel.toLowerCase() === "week" ? "a week" : `a ${label.unitLabel.toLowerCase()}`}
        </Button>

        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(async () => {
              await setSyllabusStatus(
                syllabusId,
                status === "published" ? "draft" : "published",
              );
            })
          }
        >
          {status === "published" ? "Move back to draft" : "Publish"}
        </Button>
      </div>

      <p className="max-w-2xl text-sm text-[var(--ink-muted)]">
        Publishing makes this syllabus available to put a child on. A draft is
        yours alone — children see nothing from it.
      </p>
    </div>
  );
}

function MoveButton({
  label,
  glyph,
  disabled,
  onClick,
}: {
  label: string;
  glyph: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-30"
    >
      {glyph}
    </button>
  );
}

/**
 * A unit with content in it asks twice. An empty one goes on the first click —
 * confirming the removal of nothing is just noise.
 */
function RemoveUnit({
  name,
  empty,
  disabled,
  onConfirm,
}: {
  name: string;
  empty: boolean;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);

  if (armed || empty) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
        className="rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-[var(--accent-ink)] hover:bg-[var(--notyet-soft)] disabled:opacity-30"
      >
        {empty ? "Remove" : "Really remove?"}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Remove ${name}`}
      disabled={disabled}
      onClick={() => setArmed(true)}
      className="rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)] disabled:opacity-30"
    >
      Remove
    </button>
  );
}
