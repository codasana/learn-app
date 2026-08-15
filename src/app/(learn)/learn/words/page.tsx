import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireLearner, weekPractice } from "@/lib/child-session";
import { todaysSession } from "@/lib/word-practice";

import { WordSession } from "./word-session";

export const metadata: Metadata = { title: "Words" };

export default async function WordsPage() {
  const learner = await requireLearner();

  if (!learner.enrolment?.weekId) {
    return <Nothing firstName={learner.firstName} />;
  }

  const items = await weekPractice(learner.enrolment.weekId);
  const vocabItems = items
    .filter((i) => i.type === "vocab_set")
    .map((i) => ({ id: i.id, body: i.body }));

  const cards = await todaysSession(learner.childId, vocabItems);

  if (cards.length === 0) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-16 text-center">
        <p className="text-5xl" aria-hidden="true">
          ✓
        </p>
        <h1 className="mt-4 text-2xl font-bold">
          Nothing to practise right now
        </h1>
        <p className="mt-3 text-[var(--ink-muted)]">
          You&rsquo;ve done today&rsquo;s words. They come back when it&rsquo;s
          a good time to see them again.
        </p>
        <div className="mt-8">
          <Button asChild size="lg">
            <Link href="/learn">Back to today</Link>
          </Button>
        </div>
      </main>
    );
  }

  return <WordSession cards={cards} />;
}

function Nothing({ firstName }: { firstName: string }) {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-16 text-center">
      <h1 className="text-2xl font-bold">Nothing here yet, {firstName}</h1>
      <p className="mt-3 text-[var(--ink-muted)]">
        Your teacher hasn&rsquo;t set your words yet.
      </p>
    </main>
  );
}
