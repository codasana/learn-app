import type { Metadata } from "next";
import Link from "next/link";

import { eq } from "drizzle-orm";

import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { enquiries } from "@/db/schema";
import { bookingUrlFor } from "@/lib/booking";
import { brand } from "@/lib/brand";
import { levelCheck, TOOLS } from "@/lib/tools";
import { findRunByToken } from "@/lib/tool-runs";

import { CheckRunner } from "./check-runner";

/** Belt and braces alongside the header set in next.config.ts. */
export const metadata: Metadata = {
  title: TOOLS.level_check.title,
  robots: { index: false, follow: false },
};

export default async function CheckRunPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const run = await findRunByToken(token);

  // Expired and never-existed are the same page on purpose: a wrong token
  // learns nothing about whether it was ever right.
  if (!run) {
    return (
      <main className="mx-auto w-full max-w-xl px-6 py-16">
        <p className="text-sm text-[var(--ink-faint)]">{brand.name}</p>
        <h1 className="mt-2 text-2xl font-semibold">This link has expired</h1>
        <p className="mt-3 text-[var(--ink-muted)]">
          Links last three months, and this one is past that — or it was typed
          slightly wrong. Starting again takes a few minutes and nothing is
          lost.
        </p>
        <div className="mt-6">
          <Button asChild size="lg">
            <Link href="/check">Start a new check</Link>
          </Button>
        </div>
      </main>
    );
  }

  // Prefilling the booking with the address we already hold is what stops a
  // parent booking under a second email and becoming an unmatched booking.
  const known = run.enquiryId
    ? await db.query.enquiries.findFirst({ where: eq(enquiries.id, run.enquiryId) })
    : null;

  const done = Boolean(run.completedAt);
  const result = done
    ? levelCheck.resultSchema.safeParse(run.result)
    : undefined;

  return (
    <CheckRunner
      token={token}
      childFirstName={run.childFirstName}
      alreadyKnown={Boolean(run.enquiryId)}
      questions={levelCheck.QUESTIONS}
      passage={levelCheck.READING_PASSAGE}
      listeningScript={levelCheck.LISTENING_SCRIPT}
      sectionLabels={levelCheck.SECTION_LABELS}
      result={result?.success ? levelCheck.partialResult(result.data) : null}
      /*
        Read on the server: the runner is a client component and
        CAL_BOOKING_URL is not a NEXT_PUBLIC_ value, so it is handed down
        rather than looked up.

        Only populated when this run already belongs to a family — a link the
        teacher issued, or a page revisited after submitting. Everyone else
        gets it back from the form, because until they submit there is no
        enquiry id to put on it. Null throughout degrades to "your teacher
        will write to you with times" rather than a dead button.
      */
      bookingUrl={
        run.enquiryId
          ? bookingUrlFor({
              enquiryId: run.enquiryId,
              name: known?.parentName,
              email: known?.parentEmail,
            })
          : null
      }
    />
  );
}
