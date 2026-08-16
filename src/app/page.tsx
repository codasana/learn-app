import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { Panel, PanelCluster } from "@/components/site/panels";
import { Button } from "@/components/ui/button";
import { brand, TeacherName } from "@/lib/brand";

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
 * The colour blocks are decoration and the page is finished as it stands. They
 * are not placeholders waiting on photographs.
 */

export const metadata: Metadata = {
  title: brand.tagline,
  description:
    "Two live English classes a week for children aged 8 to 11, taught by one teacher who knows your child by name, with about ten minutes of practice a day in between.",
};

/**
 * Whether there is a booking page to point at.
 *
 * The form is embedded on /book now rather than linked out — Automette added
 * height reporting, so it can size itself and a parent never leaves this
 * domain at the moment they are about to hand over their email.
 *
 * Null until the form exists, and every button that points at it simply does
 * not render. A dead link on the one page a stranger judges you by is worse
 * than one fewer button.
 */
function bookingUrl(): string | null {
  return process.env.AUTOMETTE_FORM_URL ? "/book" : null;
}

export default function Home() {
  const booking = bookingUrl();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Promises />
        <TheIdea />
        <HowItWorks />
        <AWeek />
        <Teacher booking={booking} />
        <Abroad />
        <Price />
        <LastWord booking={booking} />
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

          <PanelCluster />
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
    title: "A free check, then a free session",
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

function Teacher({ booking }: { booking: string | null }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <Panel tone="peach" className="aspect-square w-full max-w-sm" />

        <div>
          <h2 className="text-3xl font-bold sm:text-4xl">
            One teacher, and she&rsquo;ll know your child&rsquo;s name
          </h2>
          <p className="mt-4 text-lg text-[var(--ink-muted)]">
            {TeacherName()} has taught English in an international school for
            years. She plans every lesson, teaches every class, and reads every
            piece of writing herself. Nothing is handed to an assistant, and
            nothing is marked by a machine.
          </p>
          {/*
            No waiting list. There isn't one, and inventing scarcity is the
            exact sales move this programme is meant to be the opposite of —
            a parent who later finds out would be right to mind. The limit is
            real on its own and says the same thing honestly.
          */}
          <p className="mt-4 text-lg text-[var(--ink-muted)]">
            That is also the limit: she can only teach a small number of
            children at a time. It is the reason this works, and the reason we
            take on very few at once.
          </p>

          {booking && (
            <div className="mt-6">
              <Button
                asChild
                variant="secondary"
                className="rounded-[var(--radius-lg)] px-6 py-4"
              >
                <Link href={booking}>Book a free session with her</Link>
              </Button>
            </div>
          )}
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

/**
 * No number, and a reason.
 *
 * The fee is agreed per family after the free session — one child or a small
 * group, two classes a week or one. That is a real reason not to print a
 * price, but it only works if the page says it. A parent who finds no figure
 * and no explanation concludes it is expensive and leaves, which is the exact
 * outcome a page written to build trust cannot afford.
 *
 * So this section exists to answer the question rather than dodge it, and it
 * leads with the part that costs nothing.
 */
function Price() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-16">
      <div className="rounded-[var(--radius-panel)] bg-[var(--surface)] px-8 py-12 sm:px-14">
        <h2 className="text-3xl font-bold sm:text-4xl">What it costs</h2>

        <div className="mt-5 max-w-2xl space-y-4 text-lg text-[var(--ink-muted)]">
          <p>
            <strong className="text-[var(--ink)]">
              The first session is free, and there is nothing to pay until
              you&rsquo;ve met her.
            </strong>
          </p>
          <p>
            After that it depends on what suits your child — one to one or a
            small group, and how often. {TeacherName()} works that out with you
            at the end of the free session and tells you the fee then, in your own
            currency. We would rather quote you honestly than print a number
            that turns out not to apply.
          </p>
          <p>
            No joining fee. No lock-in — a month&rsquo;s notice and
            you&rsquo;re done.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function LastWord({ booking }: { booking: string | null }) {
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
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild className="rounded-[var(--radius-lg)] px-7 py-4">
            <Link href="/check">Start the free check</Link>
          </Button>
          {booking && (
            <Button
              asChild
              variant="secondary"
              className="rounded-[var(--radius-lg)] border-0 bg-[var(--surface)] px-6 py-4"
            >
              <Link href={booking}>Or just book a free session</Link>
            </Button>
          )}
        </div>

        {booking && (
          <p className="mt-5 text-[var(--ink-muted)]">
            Some people would rather talk to a person than take a test. That is
            completely fine — the session is free either way.
          </p>
        )}
      </div>
    </section>
  );
}
