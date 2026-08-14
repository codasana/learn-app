import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { PhotoCluster, PhotoSlot } from "@/components/site/photo-slot";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";

/**
 * The marketing home page.
 *
 * Written for a parent, but a parent choosing a teacher for a nine-year-old,
 * which is a different reader from a parent buying software for themselves.
 * They are asking "is this a kind place for my child?" before they ask "is
 * this competent." So the page has to feel like it is about children without
 * ever talking like one.
 *
 * The look is soft panels: colour arrives by the block, in large calm areas,
 * with generous rounding and a lot of air. Nothing shouts, and there is not a
 * cartoon anywhere — which is what lets it be warm without being childish.
 *
 * Photographs are deferred, so the panels are carrying the whole feel.
 * PhotoSlot marks where real pictures go.
 */

export const metadata: Metadata = {
  title: brand.tagline,
  description:
    "Two live English classes a week for children aged 8 to 11, taught by one teacher who knows your child by name, with about ten minutes of practice a day in between.",
};

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Promises />
        <TheIdea />
        <HowItWorks />
        <AWeek />
        <Teacher />
        <Abroad />
        <Price />
        <LastWord />
      </main>
      <SiteFooter />
    </>
  );
}

/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pt-10 pb-6">
      <div className="rounded-[var(--radius-panel)] bg-[var(--panel-lilac)] px-8 py-14 sm:px-14">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="text-4xl leading-[1.1] font-bold tracking-tight text-balance sm:text-5xl">
              Is your child&rsquo;s English really where you think it is?
            </h1>

            <p className="mt-5 max-w-lg text-lg text-[var(--ink-muted)]">
              Most children can pass the test and still not speak up in a room.
              A gentle twelve-minute check will tell you where yours actually
              stands — no sign-up, and you see the result straight away.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="rounded-[var(--radius-lg)] px-7 py-4">
                <Link href="/check">Start the free check</Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                className="rounded-[var(--radius-lg)] border-0 bg-[var(--surface)] px-6 py-4"
              >
                <Link href="#how">How classes work</Link>
              </Button>
            </div>
          </div>

          <PhotoCluster />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const PROMISES = [
  ["Two live classes a week", "var(--panel-peach)"],
  ["Ten minutes a day in between", "var(--panel-mint)"],
  ["One teacher, every single week", "var(--panel-lilac)"],
] as const;

function Promises() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="grid gap-4 sm:grid-cols-3">
        {PROMISES.map(([label, bg]) => (
          <div
            key={label}
            className="rounded-[var(--radius-card)] px-6 py-8 text-lg font-semibold"
            style={{ background: bg }}
          >
            {label}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function TheIdea() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="rounded-[var(--radius-panel)] bg-[var(--surface)] px-8 py-14 text-center sm:px-14">
        <p className="text-3xl leading-snug font-bold text-balance sm:text-4xl">
          Skills, not syllabus.
        </p>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-[var(--ink-muted)]">
          School teaches English as a subject to be examined. We teach it as a
          thing your child does — speaking without rehearsing first, writing
          something worth reading, and finishing a book because they wanted to.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const STEPS = [
  {
    n: "1",
    title: "A free check, then a free class",
    body: "Your child does the twelve-minute check on their own. Then you both meet the teacher for half an hour — no obligation, nothing to prepare.",
    tone: "var(--panel-peach)",
  },
  {
    n: "2",
    title: "Two live classes a week",
    body: "Forty-five minutes each, one child or a very small group. The same teacher every week, who marks the writing herself and remembers what your child found hard last Tuesday.",
    tone: "var(--panel-mint)",
  },
  {
    n: "3",
    title: "Ten minutes a day in between",
    body: "Words to practise, something short to read, a piece of writing to hand in. It's on a phone or a tablet and takes about as long as brushing teeth.",
    tone: "var(--panel-butter)",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-5xl px-6 pb-16">
      <h2 className="text-3xl font-bold sm:text-4xl">How it works</h2>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="rounded-[var(--radius-card)] bg-[var(--surface)] p-7"
          >
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold"
              style={{ background: s.tone }}
            >
              {s.n}
            </span>
            <h3 className="mt-5 text-xl font-bold">{s.title}</h3>
            <p className="mt-2 text-[var(--ink-muted)]">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const WEEK = [
  ["Monday", "Live class — something new", true],
  ["Tuesday", "Ten minutes: words and a short read", false],
  ["Wednesday", "Ten minutes: listening", false],
  ["Thursday", "Live class — talking and writing", true],
  ["Friday", "Hand in the week's writing", false],
  ["Weekend", "Nothing, unless they want to", false],
] as const;

function AWeek() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="rounded-[var(--radius-panel)] bg-[var(--panel-mint)] px-8 py-14 sm:px-14">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold sm:text-4xl">
              What a week actually looks like
            </h2>
            <p className="mt-4 text-lg text-[var(--ink-muted)]">
              We would rather show you than describe it. Nothing here is a
              surprise, and the weekend is genuinely free — a programme that
              eats a family&rsquo;s Sunday gets abandoned by March.
            </p>
          </div>

          <ul className="space-y-2">
            {WEEK.map(([day, what, isClass]) => (
              <li
                key={day}
                className="flex flex-wrap items-baseline gap-x-4 rounded-[var(--radius)] bg-[var(--surface)] px-5 py-3.5"
              >
                <span className="w-24 shrink-0 font-bold">{day}</span>
                <span
                  className={
                    isClass
                      ? "font-medium text-[var(--primary)]"
                      : "text-[var(--ink-muted)]"
                  }
                >
                  {what}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Teacher() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <PhotoSlot
          label="A portrait of the teacher will go here"
          tone="peach"
          className="aspect-square w-full max-w-sm"
        />

        <div>
          <h2 className="text-3xl font-bold sm:text-4xl">
            One teacher, and she&rsquo;ll know your child&rsquo;s name
          </h2>
          <p className="mt-4 text-lg text-[var(--ink-muted)]">
            Sheeba has taught English in an international school for years. She
            plans every lesson, teaches every class, and reads every piece of
            writing herself. Nothing is handed to an assistant, and nothing is
            marked by a machine.
          </p>
          <p className="mt-4 text-lg text-[var(--ink-muted)]">
            That is also the limit: she can only take a small number of
            children. It is the reason this works, and the reason there is a
            waiting list.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Abroad() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="rounded-[var(--radius-panel)] bg-[var(--panel-butter)] px-8 py-12 sm:px-14">
        <h2 className="text-2xl font-bold sm:text-3xl">
          If you&rsquo;re not in India
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-[var(--ink-muted)]">
          Plenty of these children are in Dubai, Singapore and further out. You
          pick class times in your own timezone, and everything you are sent —
          the schedule, the reminders, the reports — is in your time, not ours.
          If a class clashes with something, you move it from your phone.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Price() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-16">
      <h2 className="text-3xl font-bold sm:text-4xl">What it costs</h2>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          ["In India", "₹0,000", "a month"],
          ["Outside India", "$00", "a month"],
        ].map(([where, amount, per]) => (
          <div
            key={where}
            className="rounded-[var(--radius-card)] border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8"
          >
            <p className="text-sm font-semibold tracking-wide text-[var(--ink-faint)] uppercase">
              {where}
            </p>
            <p className="mt-2 text-4xl font-bold">
              {amount}{" "}
              <span className="text-xl font-normal text-[var(--ink-muted)]">
                {per}
              </span>
            </p>
            <p className="mt-3 text-[var(--ink-muted)]">
              Two live classes a week, all the practice in between, and a report
              every term.
            </p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-[var(--ink-muted)]">
        No joining fee. No lock-in — a month&rsquo;s notice and you&rsquo;re
        done. The first class is free, and there is nothing to pay until you
        have met her.
      </p>

      {/*
        The dashed borders and zeroed figures are on purpose: this is the one
        thing on the page that is not ready, and a made-up number would be
        worse than an obvious gap. Set the real ones and the dashes come off.
      */}
      <p className="mt-3 text-sm text-[var(--ink-faint)]">
        (Figures still to be set — the boxes stay dashed until they are.)
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function LastWord() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-20">
      <div className="rounded-[var(--radius-panel)] bg-[var(--panel-lilac)] px-8 py-14 text-center sm:px-14">
        <h2 className="text-3xl font-bold text-balance sm:text-4xl">
          Start with the free check
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--ink-muted)]">
          Twelve minutes, nothing to sign up for, and you will know more than
          you did this morning. If it turns out your child is doing fine, we
          will tell you that.
        </p>
        <div className="mt-8">
          <Button asChild className="rounded-[var(--radius-lg)] px-7 py-4">
            <Link href="/check">Start the free check</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
