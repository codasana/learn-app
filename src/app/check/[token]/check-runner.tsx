"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Notice } from "@/components/ui/field";
import { brand } from "@/lib/brand";

import { requestReport, submitCheck } from "../actions";

type Question = {
  id: string;
  section: "vocabulary" | "reading" | "listening";
  prompt: string;
  options: string[];
};

type Partial = { total: number; outOf: number; strongest: string };

export function CheckRunner({
  token,
  childFirstName,
  alreadyKnown,
  questions,
  passage,
  listeningScript,
  sectionLabels,
  result,
}: {
  token: string;
  childFirstName: string | null;
  alreadyKnown: boolean;
  questions: Question[];
  passage: { title: string; paragraphs: string[] };
  listeningScript: string;
  sectionLabels: Record<string, string>;
  result: Partial | null;
}) {
  if (result) {
    return (
      <Result
        token={token}
        childFirstName={childFirstName}
        alreadyKnown={alreadyKnown}
        result={result}
      />
    );
  }
  return (
    <Quiz
      token={token}
      childFirstName={childFirstName}
      questions={questions}
      passage={passage}
      listeningScript={listeningScript}
      sectionLabels={sectionLabels}
    />
  );
}

/* ------------------------------------------------------------------ */

function Quiz({
  token,
  childFirstName,
  questions,
  passage,
  listeningScript,
  sectionLabels,
}: {
  token: string;
  childFirstName: string | null;
  questions: Question[];
  passage: { title: string; paragraphs: string[] };
  listeningScript: string;
  sectionLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sections = [...new Set(questions.map((q) => q.section))];
  const answered = Object.keys(answers).length;

  async function onSubmit() {
    setPending(true);
    setMessage(null);
    const res = await submitCheck(token, answers);
    setPending(false);
    if (!res.ok) {
      setMessage(
        res.error === "expired"
          ? "This link has expired. You can start a new check."
          : "Something went wrong. Try that once more.",
      );
      return;
    }
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <p className="text-sm text-[var(--ink-faint)]">{brand.name}</p>
      <h1 className="mt-2 text-2xl font-semibold">
        {childFirstName ? `Hello, ${childFirstName}` : "Hello"}
      </h1>
      <p className="mt-2 text-[var(--ink-muted)]">
        Answer what you can. If you&rsquo;re not sure, choose the one that feels
        closest — nobody is marking you, and you can&rsquo;t fail this.
      </p>

      {message ? (
        <div className="mt-6">
          <Notice>{message}</Notice>
        </div>
      ) : null}

      {sections.map((section) => (
        <section key={section} className="mt-10">
          <h2 className="text-sm font-medium tracking-wide text-[var(--ink-faint)] uppercase">
            {sectionLabels[section]}
          </h2>

          {section === "reading" && (
            <div className="mt-3 space-y-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="font-medium">{passage.title}</p>
              {passage.paragraphs.map((p, i) => (
                <p key={i} className="text-[var(--ink)]">
                  {p}
                </p>
              ))}
            </div>
          )}

          {section === "listening" && (
            <div className="mt-3 space-y-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-sm text-[var(--ink-muted)]">
                Read this out loud once, then answer without looking back.
              </p>
              <p className="whitespace-pre-line text-[var(--ink)]">
                {listeningScript}
              </p>
            </div>
          )}

          <ol className="mt-4 space-y-6">
            {questions
              .filter((q) => q.section === section)
              .map((q) => (
                <li key={q.id}>
                  <p className="font-medium">{q.prompt}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {q.options.map((opt, i) => {
                      const chosen = answers[q.id] === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          aria-pressed={chosen}
                          onClick={() =>
                            setAnswers((a) => ({ ...a, [q.id]: i }))
                          }
                          className={`min-h-[var(--tap-target)] rounded-[var(--radius)] border px-4 text-base transition-colors ${
                            chosen
                              ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--ink-on-primary)]"
                              : "border-[var(--border-strong)] bg-[var(--surface)] hover:bg-[var(--surface-sunken)]"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
          </ol>
        </section>
      ))}

      <div className="mt-12 space-y-3">
        <p className="text-sm text-[var(--ink-muted)]">
          {answered} of {questions.length} answered.
        </p>
        <Button size="lg" disabled={pending || answered === 0} onClick={onSubmit}>
          {pending ? "Checking…" : "I'm finished"}
        </Button>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function Result({
  token,
  childFirstName,
  alreadyKnown,
  result,
}: {
  token: string;
  childFirstName: string | null;
  alreadyKnown: boolean;
  result: Partial;
}) {
  const [sent, setSent] = useState(alreadyKnown);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const who = childFirstName ?? "Your child";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const res = await requestReport(token, new FormData(e.currentTarget));
    setPending(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <p className="text-sm text-[var(--ink-faint)]">{brand.name}</p>
      <h1 className="mt-2 text-2xl font-semibold">All done{childFirstName ? `, ${childFirstName}` : ""}</h1>

      <div className="mt-6 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-4xl font-semibold tabular-nums">
          {result.total}
          <span className="text-xl text-[var(--ink-muted)]">
            {" "}
            out of {result.outOf}
          </span>
        </p>
        <p className="mt-2 text-[var(--ink-muted)]">
          Strongest area: <strong className="text-[var(--ink)]">{result.strongest}</strong>
        </p>
      </div>

      {/*
        Save-the-link comes BEFORE the ask. A child who does not want to hand
        over a parent's email should still leave with something in their hands
        — and that same link is how they show a parent later.
      */}
      <div className="mt-6 rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] p-5">
        <p className="font-medium">Keep this page</p>
        <p className="mt-1 text-[var(--ink-muted)]">
          This link is yours. Save it and you can come back to this result — or
          send it to a parent to look at.
        </p>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy the link"}
        </Button>
      </div>

      {sent ? (
        <div className="mt-8 rounded-[var(--radius-card)] bg-[var(--correct-soft)] p-5">
          <p className="font-medium text-[var(--correct)]">
            Thank you — we have what we need.
          </p>
          <p className="mt-1 text-[var(--ink-muted)]">
            The full report goes out by email, and it comes with a free class
            with the teacher. She reads every one of these herself, so it may
            take a day.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <h2 className="text-lg font-medium">Would you like the full report?</h2>
            <p className="mt-1 text-[var(--ink-muted)]">
              It&rsquo;s one page: what {who} did well, what to work on next, and
              where they&rsquo;d start. It&rsquo;s free, and so is the class that comes with
              it. Ask a parent to fill this in.
            </p>
          </div>

          {message ? <Notice>{message}</Notice> : null}

          <Field label="Parent's name" htmlFor="parentName">
            <Input id="parentName" name="parentName" required autoComplete="name" />
          </Field>

          <Field label="Email" htmlFor="parentEmail">
            <Input
              id="parentEmail"
              name="parentEmail"
              type="email"
              required
              autoComplete="email"
            />
          </Field>

          <Field
            label="WhatsApp"
            htmlFor="whatsapp"
            hint="Optional. Only for reminders, never for marketing."
          >
            <Input id="whatsapp" name="whatsapp" autoComplete="tel" />
          </Field>

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Sending…" : "Send me the report"}
          </Button>

          <p className="text-sm text-[var(--ink-faint)]">
            We keep your details for twelve months so we can tell you when the
            next term opens, then we delete them. We don&rsquo;t pass them to anyone.
          </p>
        </form>
      )}
    </main>
  );
}
