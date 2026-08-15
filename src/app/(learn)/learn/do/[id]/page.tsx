import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { writingSubmissions } from "@/db/schema";
import { requireLearner, weekPractice } from "@/lib/child-session";
import {
  passageBody,
  quizBody,
  sentenceBuilderBody,
  writingTaskBody,
} from "@/lib/content-schemas";
import { shuffle } from "@/lib/shuffle";

import { PassagePlayer } from "./passage-player";
import { QuizPlayer } from "./quiz-player";
import { SentencePlayer } from "./sentence-player";
import { WritingPlayer } from "./writing-player";

export const metadata: Metadata = { title: "Practice" };

/**
 * One activity.
 *
 * The item is looked up *within the child's current week* rather than by id
 * alone. A child cannot open something from another week, another child's
 * syllabus, or a teacher-only answer key by changing the address — those items
 * simply are not in the list this resolves against.
 */
export default async function DoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const learner = await requireLearner();
  const { id } = await params;

  if (!learner.enrolment?.weekId) notFound();

  const items = await weekPractice(learner.enrolment.weekId);
  const item = items.find((i) => i.id === id);
  if (!item) notFound();

  switch (item.type) {
    case "passage": {
      const body = passageBody.safeParse(item.body);
      if (!body.success) notFound();
      return (
        <PassagePlayer
          id={item.id}
          title={item.title}
          paragraphs={body.data.paragraphs}
          questions={body.data.questions}
        />
      );
    }

    case "quiz": {
      const body = quizBody.safeParse(item.body);
      if (!body.success) notFound();
      return (
        <QuizPlayer
          id={item.id}
          title={item.title}
          questions={body.data.questions}
        />
      );
    }

    case "sentence_builder": {
      const body = sentenceBuilderBody.safeParse(item.body);
      if (!body.success) notFound();
      return (
        <SentencePlayer
          id={item.id}
          title={item.title}
          // Shuffled here, on the server. Doing it in the component would
          // render one order in the HTML and another after hydration.
          items={body.data.items.map((i) => ({
            correctSentence: i.correctSentence,
            tiles: shuffle(i.tiles),
          }))}
        />
      );
    }

    case "writing_task": {
      const body = writingTaskBody.safeParse(item.body);
      if (!body.success) notFound();

      const existing = await db.query.writingSubmissions.findFirst({
        where: and(
          eq(writingSubmissions.childId, learner.childId),
          eq(writingSubmissions.writingTaskId, item.id),
        ),
        // `ai_draft` and the teacher's private notes are deliberately not
        // selected. Nothing generated reaches a child unreleased.
        columns: { body: true, status: true, teacherFeedback: true },
      });

      return (
        <WritingPlayer
          id={item.id}
          title={item.title}
          prompt={body.data.prompt}
          planningBoxes={body.data.planningBoxes}
          existing={
            existing
              ? {
                  body: existing.body ?? "",
                  status: existing.status,
                  feedback:
                    existing.status === "released" ||
                    existing.status === "redrafted"
                      ? (existing.teacherFeedback ?? null)
                      : null,
                }
              : null
          }
        />
      );
    }

    default:
      return (
        <main className="mx-auto w-full max-w-md px-6 py-16 text-center">
          <h1 className="text-2xl font-bold">{item.title}</h1>
          <p className="mt-3 text-[var(--ink-muted)]">
            This one happens in your class with your teacher.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href="/learn">Back to today</Link>
            </Button>
          </div>
        </main>
      );
  }
}
