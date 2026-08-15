"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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
/* The check                                                           */
/* ------------------------------------------------------------------ */

/**
 * The whole thing used to be one page: eighteen questions in three stacked
 * sections with a submit button at the bottom. That is a form. A child looking
 * at eighteen questions at once counts them, and a nine-year-old counting
 * questions has already decided how they feel about this.
 *
 * So: one question on screen at a time. Tapping an answer moves you on by
 * itself — no answer, then reach for Next — which turns twelve minutes of
 * form-filling into eighteen taps. The bar at the top is the only thing that
 * says how much is left, and it fills.
 *
 * What it deliberately does NOT do is tell them whether they were right.
 * This is a placement check: marking each answer would demoralise the child it
 * is most trying to reach, and would hand the answer key to anyone who wanted
 * it. Every screen is warm and neutral, and the result comes at the end.
 */

type Step =
  | { kind: "intro"; section: string }
  | { kind: "question"; q: Question }
  | { kind: "finish" };

function buildSteps(questions: Question[]): Step[] {
  const steps: Step[] = [];
  let current = "";

  for (const q of questions) {
    // A section's intro screen carries whatever that section needs to be
    // read or heard before its questions make any sense.
    if (q.section !== current) {
      steps.push({ kind: "intro", section: q.section });
      current = q.section;
    }
    steps.push({ kind: "question", q });
  }

  steps.push({ kind: "finish" });
  return steps;
}

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
  const steps = useMemo(() => buildSteps(questions), [questions]);

  const [at, setAt] = useState(-1); // -1 is the welcome screen
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const step = at >= 0 ? steps[at] : null;
  const answered = Object.keys(answers).length;

  // Moving to a new screen must move the reader too. Without this the page
  // stays scrolled where the last answer was and the next question appears
  // to be missing.
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [at]);

  function choose(q: Question, i: number) {
    setAnswers((a) => ({ ...a, [q.id]: i }));
    // A beat, so the choice is visibly registered before the screen changes.
    // Without it the answer appears not to have been taken.
    window.setTimeout(() => setAt((n) => Math.min(n + 1, steps.length - 1)), 260);
  }

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

  /* --- the welcome screen ----------------------------------------- */

  if (!step) {
    return (
      <Shell>
        <div className="rounded-[var(--radius-card)] bg-[var(--panel-lilac)] px-7 py-10">
          <p className="text-sm text-[var(--ink-muted)]">{brand.name}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {childFirstName ? `Hello, ${childFirstName}!` : "Hello!"}
          </h1>
          <p className="mt-3 text-lg leading-relaxed">
            There are {questions.length} things to try. Some are about words,
            one is a story to read, and one is something to listen to.
          </p>
          <p className="mt-3 text-[var(--ink-muted)]">
            Nobody is marking you and you cannot fail this. If you are not sure,
            pick the one that feels closest.
          </p>
          <Button size="lg" className="mt-7 w-full" onClick={() => setAt(0)}>
            I&rsquo;m ready
          </Button>
        </div>
      </Shell>
    );
  }

  /* --- a section's opening screen ---------------------------------- */

  if (step.kind === "intro") {
    const isReading = step.section === "reading";
    const isListening = step.section === "listening";

    return (
      <Shell>
        <Progress answered={answered} total={questions.length} />

        <div
          ref={heading}
          tabIndex={-1}
          className="mt-8 outline-none"
          aria-live="polite"
        >
          <p className="text-sm font-medium tracking-wide text-[var(--ink-faint)] uppercase">
            {sectionLabels[step.section]}
          </p>

          {isReading && (
            <>
              <h2 className="mt-2 text-2xl font-bold">
                Read this story, then I&rsquo;ll ask you about it.
              </h2>
              <div className="mt-5 space-y-3 rounded-[var(--radius-card)] bg-[var(--panel-butter)] px-6 py-6 text-lg leading-relaxed">
                <p className="font-bold">{passage.title}</p>
                {passage.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </>
          )}

          {isListening && (
            <>
              <h2 className="mt-2 text-2xl font-bold">
                Ask a grown-up to read this to you, once.
              </h2>
              <p className="mt-2 text-[var(--ink-muted)]">
                Then answer without looking back at it.
              </p>
              <div className="mt-5 rounded-[var(--radius-card)] bg-[var(--panel-mint)] px-6 py-6 text-lg leading-relaxed whitespace-pre-line">
                {listeningScript}
              </div>
            </>
          )}

          {!isReading && !isListening && (
            <>
              <h2 className="mt-2 text-2xl font-bold">
                First, some words.
              </h2>
              <p className="mt-3 text-lg text-[var(--ink-muted)]">
                One tap each. There are no trick questions in here.
              </p>
            </>
          )}
        </div>

        <Button size="lg" className="mt-8 w-full" onClick={() => setAt(at + 1)}>
          {isReading
            ? "I’ve read it"
            : isListening
              ? "I’ve heard it"
              : "Start"}
        </Button>
      </Shell>
    );
  }

  /* --- one question ------------------------------------------------ */

  if (step.kind === "question") {
    const q = step.q;
    const chosen = answers[q.id];

    return (
      <Shell>
        <Progress answered={answered} total={questions.length} />

        <div ref={heading} tabIndex={-1} className="mt-10 outline-none">
          <h2 className="text-2xl leading-snug font-bold" aria-live="polite">
            {q.prompt}
          </h2>

          <div className="mt-7 space-y-3">
            {q.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={chosen === i}
                onClick={() => choose(q, i)}
                className={`flex min-h-[var(--tap-target)] w-full items-center rounded-[var(--radius-lg)] border-2 px-5 py-4 text-left text-lg transition-colors ${
                  chosen === i
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--ink-on-primary)]"
                    : "border-[var(--border-strong)] bg-[var(--surface)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/*
          The reading questions come after the passage screen, and a child who
          has forgotten a detail should not have to abandon the check to look.
        */}
        {q.section === "reading" && (
          <details className="mt-7 rounded-[var(--radius)] bg-[var(--surface-sunken)] px-4 py-3">
            <summary className="cursor-pointer text-[var(--ink-muted)]">
              Read the story again
            </summary>
            <div className="mt-3 space-y-2">
              <p className="font-medium">{passage.title}</p>
              {passage.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </details>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="quiet" onClick={() => setAt(Math.max(0, at - 1))}>
            Back
          </Button>
          {/* Skipping is allowed on purpose: a child stuck on one question
              should not be stuck on the whole check. */}
          <Button variant="quiet" onClick={() => setAt(at + 1)}>
            {chosen === undefined ? "Skip this one" : "Next"}
          </Button>
        </div>
      </Shell>
    );
  }

  /* --- the last screen --------------------------------------------- */

  const missed = questions.length - answered;

  return (
    <Shell>
      <Progress answered={answered} total={questions.length} />

      <div ref={heading} tabIndex={-1} className="mt-10 outline-none">
        <div className="rounded-[var(--radius-card)] bg-[var(--panel-mint)] px-7 py-10 text-center">
          <p className="text-5xl" aria-hidden="true">
            🎉
          </p>
          <h2 className="mt-3 text-2xl font-bold">
            That&rsquo;s everything{childFirstName ? `, ${childFirstName}` : ""}.
          </h2>
          <p className="mt-2 text-[var(--ink-muted)]">
            {missed === 0
              ? "You answered every one."
              : missed === 1
                ? "You left one out — that's completely fine."
                : `You left ${missed} out — that's completely fine.`}
          </p>
        </div>

        {message ? (
          <div className="mt-6">
            <Notice>{message}</Notice>
          </div>
        ) : null}

        <Button
          size="lg"
          className="mt-7 w-full"
          disabled={pending || answered === 0}
          onClick={onSubmit}
        >
          {pending ? "Checking…" : "See how I did"}
        </Button>

        {missed > 0 && (
          <Button
            variant="quiet"
            className="mt-2 w-full"
            onClick={() => setAt(0)}
          >
            Go back through them
          </Button>
        )}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-10">
      {children}
    </main>
  );
}

/** How far along, and nothing else. No score, no timer, no question numbers. */
function Progress({ answered, total }: { answered: number; total: number }) {
  const pct = Math.round((answered / total) * 100);
  return (
    <div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]"
        role="progressbar"
        aria-valuenow={answered}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="How far through the check you are"
      >
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-[var(--ink-faint)]">
        {answered} of {total}
      </p>
    </div>
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

  // Lower case: this only ever appears mid-sentence.
  const who = childFirstName ?? "your child";

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
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        All done{childFirstName ? `, ${childFirstName}` : ""}
      </h1>

      <div className="mt-6 rounded-[var(--radius-card)] bg-[var(--panel-lilac)] px-7 py-8">
        <p className="text-5xl font-bold tabular-nums">
          {result.total}
          <span className="text-2xl font-medium text-[var(--ink-muted)]">
            {" "}
            out of {result.outOf}
          </span>
        </p>
        <p className="mt-3 text-lg">
          Strongest area:{" "}
          <strong className="font-bold">{result.strongest}</strong>
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
            <h2 className="text-lg font-medium">
              Would you like the full report?
            </h2>
            <p className="mt-1 text-[var(--ink-muted)]">
              It&rsquo;s one page: what {who} did well, what to work on next, and
              where they&rsquo;d start. It&rsquo;s free, and so is the class that
              comes with it. Ask a parent to fill this in.
            </p>
          </div>

          {message ? <Notice>{message}</Notice> : null}

          <Field label="Parent's name" htmlFor="parentName">
            <Input
              id="parentName"
              name="parentName"
              required
              autoComplete="name"
            />
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
            next term opens, then we delete them. We don&rsquo;t pass them to
            anyone.
          </p>
        </form>
      )}
    </main>
  );
}
