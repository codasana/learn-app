"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Notice } from "@/components/ui/field";
import { createSyllabus } from "./actions";

export function NewSyllabus({ hasAny }: { hasAny: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!hasAny);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setPending(true);

    const result = await createSyllabus(new FormData(e.currentTarget));
    setPending(false);

    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    router.push(`/teacher/syllabus/${result.id}`);
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Start a new syllabus
      </Button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-xl space-y-5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <div>
        <h2 className="font-medium">Start a new syllabus</h2>
        <p className="text-sm text-[var(--ink-muted)]">
          The weeks start empty. You can add or remove weeks later, so a rough
          guess is fine.
        </p>
      </div>

      {message ? <Notice>{message}</Notice> : null}

      <Field label="Name" htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          autoFocus
          placeholder="Beginners · December 2026 term"
        />
      </Field>

      <Field label="How many weeks" htmlFor="weeks" hint="A term is twelve.">
        <Input
          id="weeks"
          name="weeks"
          type="number"
          min={1}
          max={52}
          defaultValue={12}
        />
      </Field>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create"}
        </Button>
        {hasAny && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
