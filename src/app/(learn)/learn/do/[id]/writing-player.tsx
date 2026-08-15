"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Notice, Textarea } from "@/components/ui/field";

import { submit } from "./actions";

/**
 * The writing task.
 *
 * Nothing here is scored, corrected, or auto-commented. The child writes, and
 * a person reads it — that is the whole promise of the programme and the one
 * place it would be most tempting to substitute a machine. No AI text ever
 * reaches a child unreleased, so the teacher's draft column is not even
 * fetched by the page that renders this.
 *
 * The planning boxes are prompts, not fields. A child who wants to write
 * straight into the box should be able to; the boxes are for the ones who
 * stare at a blank page.
 */
export function WritingPlayer({
  id,
  title,
  prompt,
  planningBoxes,
  existing,
}: {
  id: string;
  title: string;
  prompt: string;
  planningBoxes: string[];
  existing: {
    body: string;
    status: string;
    feedback: string | null;
  } | null;
}) {
  const [text, setText] = useState(existing?.body ?? "");
  const [sent, setSent] = useState(existing?.status === "submitted");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feedback = existing?.feedback ?? null;

  async function send() {
    setSaving(true);
    setError(null);
    const res = await submit(id, { kind: "text", body: text });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "That didn't send. Try again.");
      return;
    }
    setSent(true);
  }

  if (feedback) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 pt-4 pb-10">
        <h1 className="text-2xl font-bold">{title}</h1>

        <section className="mt-6 rounded-[var(--radius-card)] bg-[var(--panel-mint)] p-6">
          <p className="font-bold">What your teacher said</p>
          <p className="mt-2 text-lg whitespace-pre-line">{feedback}</p>
        </section>

        <section className="mt-6 rounded-[var(--radius-card)] bg-[var(--surface)] p-6">
          <p className="text-sm text-[var(--ink-faint)]">What you wrote</p>
          <p className="mt-2 text-lg whitespace-pre-line">{existing?.body}</p>
        </section>

        <div className="mt-8">
          <Button asChild size="lg">
            <Link href="/learn">Back to today</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (sent) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-6xl" aria-hidden="true">
          ✉️
        </p>
        <h1 className="mt-4 text-3xl font-bold">Sent to your teacher</h1>
        <p className="mt-3 text-lg text-[var(--ink-muted)]">
          She reads every one herself, so it might take a day or two. You&rsquo;ll
          see what she says right here.
        </p>
        <div className="mt-10 w-full space-y-3">
          <Button asChild size="lg">
            <Link href="/learn">Back to today</Link>
          </Button>
          <Button variant="quiet" onClick={() => setSent(false)}>
            Change what I wrote
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 pt-4 pb-10">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-3 text-lg">{prompt}</p>

      {planningBoxes.filter(Boolean).length > 0 && (
        <section className="mt-6 rounded-[var(--radius-card)] bg-[var(--panel-butter)] p-5">
          <p className="font-medium">Things you could write about</p>
          <ul className="mt-2 space-y-1 text-lg">
            {planningBoxes.filter(Boolean).map((box, i) => (
              <li key={i}>· {box}</li>
            ))}
          </ul>
        </section>
      )}

      {error ? (
        <div className="mt-6">
          <Notice>{error}</Notice>
        </div>
      ) : null}

      <div className="mt-6">
        <Textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Start writing here…"
          className="text-lg"
          aria-label="Your writing"
        />
        <p className="mt-2 text-sm text-[var(--ink-faint)]">
          Don&rsquo;t worry about spelling. Your teacher cares more about what
          you have to say.
        </p>
      </div>

      <div className="mt-6">
        <Button size="lg" disabled={saving || text.trim().length < 5} onClick={send}>
          {saving ? "Sending…" : "Send it to my teacher"}
        </Button>
      </div>
    </main>
  );
}
