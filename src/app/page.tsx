import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import {
  CircleMark,
  PhotoSlot,
  Squiggle,
  Underline,
} from "@/components/site/marks";
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
 * The fun is in the craft — big confident type, colour in whole blocks, cards
 * a degree off square, a word circled by hand. Not in cartoons, which are the
 * fastest way to lose the parent it is written for.
 *
 * Photographs are deferred, so colour and type are carrying the entire feel.
 * PhotoSlot marks where real pictures go; see components/site/marks.
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
        <TheProblem />
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
    <section className="mx-auto w-full max-w-5xl px-6 pt-16 pb-20 sm:pt-24">
      <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Is your child&rsquo;s English really{" "}
            <span className="relative inline-block whitespace-nowrap text-[var(--primary)]">
              where you think
              <Underline className="text-[var(--accent)]" />
            </span>{" "}
            it is?
          </h1>

          <p className="mt-6 max-w-xl text-lg text-[var(--ink-muted)] sm:text-xl">
            Most children can pass the test and still not speak up in a room.
            Find out where yours actually stands — twelve minutes, no sign-up,
            and you see the result straight away.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild className="px-6 text-lg">
              <Link href="/check">Check your child&rsquo;s English</Link>
            </Button>
            <Link
              href="#how"
              className="text-[var(--ink-muted)] underline-offset-4 hover:text-[var(--ink)] hover:underline"
            >
              or read about the classes
            </Link>
          </div>

          <p className="mt-6 flex items-center gap-2 text-sm text-[var(--ink-faint)]">
            <Squiggle className="-mt-4 text-[var(--accent)]" />
            It&rsquo;s free, and we don&rsquo;t ask for your email to start.
          </p>
        </div>

        <PhotoSlot
          label="A photograph of a child in a live class will go here"
          className="aspect-4/5 w-full rotate-1 shadow-[var(--shadow-lg)]"
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function TheProblem() {
  return (
    <section className="bg-[var(--primary)] py-20 text-white">
      <div className="mx-auto w-full max-w-3xl px-6 text-center">
        <p className="font-[family-name:var(--font-display)] text-3xl leading-snug font-semibold text-balance sm:text-4xl">
          Skills, not syllabus.
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">
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
  },
  {
    n: "2",
    title: "Two live classes a week",
    body: "Forty-five minutes each, one child or a very small group. The same teacher every week, who marks the writing herself and knows what your child found hard last Tuesday.",
  },
  {
    n: "3",
    title: "Ten minutes a day in between",
    body: "Words to practise, something short to read, a piece of writing to hand in. It's on a phone or a tablet, and it takes about as long as brushing teeth.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-5xl px-6 py-24">
      <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">
        How it works
      </h2>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div
            key={s.n}
            /*
             * Each card sits a fraction off square, alternating direction. It
             * is barely perceptible and it is the difference between a page
             * that feels made and a page that feels generated.
             */
            className={`rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)] ${
              i % 2 === 0 ? "md:-rotate-[0.6deg]" : "md:rotate-[0.6deg]"
            }`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)] font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--accent-ink)]">
              {s.n}
            </span>
            <h3 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold">
              {s.title}
            </h3>
            <p className="mt-2 text-[var(--ink-muted)]">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const WEEK = [
  ["Monday", "Live class — something new"],
  ["Tuesday", "Ten minutes: words and a short read"],
  ["Wednesday", "Ten minutes: listening"],
  ["Thursday", "Live class — talking and writing"],
  ["Friday", "Hand in the week's writing"],
  ["Weekend", "Nothing, unless they want to"],
];

function AWeek() {
  return (
    <section className="bg-[var(--surface-sunken)] py-24">
      <div className="mx-auto grid w-full max-w-5xl gap-12 px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">
            What a week actually looks like
          </h2>
          <p className="mt-4 text-lg text-[var(--ink-muted)]">
            We would rather show you than describe it. Nothing here is a
            surprise, and the weekend is genuinely free — a programme that eats
            a family&rsquo;s Sunday gets abandoned by March.
          </p>
        </div>

        <ul className="space-y-2">
          {WEEK.map(([day, what], i) => (
            <li
              key={day}
              className="flex flex-wrap items-baseline gap-x-4 rounded-[var(--radius)] bg-[var(--surface)] px-5 py-3.5"
            >
              <span className="w-24 shrink-0 font-[family-name:var(--font-display)] font-semibold">
                {day}
              </span>
              <span
                className={
                  i === 0 || i === 3
                    ? "text-[var(--primary)]"
                    : "text-[var(--ink-muted)]"
                }
              >
                {what}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Teacher() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-24">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <PhotoSlot
          label="A portrait of the teacher will go here"
          className="aspect-square w-full max-w-sm -rotate-1 shadow-[var(--shadow-lg)]"
        />

        <div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">
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
            children. It is the reason this works and the reason there is a
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
    <section className="mx-auto w-full max-w-5xl px-6 pb-24">
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-12">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
          If you&rsquo;re not in India
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-[var(--ink-muted)]">
          Plenty of these children are in Dubai, Singapore and further. You pick
          class times in your own timezone, and everything you are sent — the
          schedule, the reminders, the reports — is in your time, not ours. If a
          class clashes with something, you move it from your phone.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Price() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-24">
      <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">
        What it costs
      </h2>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {[
          ["In India", "₹0,000", "a month"],
          ["Outside India", "$00", "a month"],
        ].map(([where, amount, per]) => (
          <div
            key={where}
            className="rounded-[var(--radius-card)] border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8"
          >
            <p className="text-sm tracking-wide text-[var(--ink-faint)] uppercase">
              {where}
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold">
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
        done. The first class is free and there is nothing to pay until you have
        met her.
      </p>

      {/*
        The dashed borders and zeroed figures are on purpose: this is the one
        thing on the page that is not ready, and a made-up number would be
        worse than an obvious gap. Set the real ones and the dashes come off.
      */}
      <p className="mt-3 text-sm text-[var(--ink-faint)]">
        (Figures still to be set — the boxes are dashed until they are.)
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function LastWord() {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-24 text-center">
      <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-balance sm:text-4xl">
        Start with the{" "}
        <span className="relative inline-block whitespace-nowrap">
          free check
          <CircleMark className="text-[var(--accent)]" />
        </span>
      </h2>
      <p className="mt-6 text-lg text-[var(--ink-muted)]">
        Twelve minutes, nothing to sign up for, and you will know more than you
        did this morning. If it turns out your child is doing fine, we will tell
        you that.
      </p>
      <div className="mt-8">
        <Button asChild className="px-6 text-lg">
          <Link href="/check">Check your child&rsquo;s English</Link>
        </Button>
      </div>
    </section>
  );
}
