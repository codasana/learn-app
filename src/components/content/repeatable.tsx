"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * Shared chrome for the "list of things you can add, remove and reorder"
 * pattern that every content editor needs — words, questions, paragraphs.
 */
export function RowList({
  children,
  onAdd,
  addLabel,
  empty,
}: {
  children: ReactNode;
  onAdd: () => void;
  addLabel: string;
  empty?: string;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <div className="space-y-3">
      {hasRows ? (
        <div className="space-y-3">{children}</div>
      ) : (
        <p className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] px-4 py-6 text-center text-[var(--ink-muted)]">
          {empty ?? "Nothing here yet."}
        </p>
      )}
      <Button type="button" variant="secondary" onClick={onAdd}>
        {addLabel}
      </Button>
    </div>
  );
}

export function Row({
  index,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  children,
}: {
  index: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--ink-faint)]">
          {index + 1}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          aria-label={`Move item ${index + 1} up`}
          className="rounded px-2 py-1 text-sm text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          aria-label={`Move item ${index + 1} down`}
          className="rounded px-2 py-1 text-sm text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove item ${index + 1}`}
          className="rounded px-2 py-1 text-sm text-[var(--accent-ink)] hover:bg-[var(--notyet-soft)]"
        >
          Remove
        </button>
      </div>
      {children}
    </div>
  );
}

/** Small helpers so every editor reorders the same way. */
export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

export function updateAt<T>(list: T[], index: number, patch: Partial<T>): T[] {
  return list.map((item, i) => (i === index ? { ...item, ...patch } : item));
}
