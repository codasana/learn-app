import "server-only";

/**
 * Creating and reading a tool run.
 *
 * **The token in the URL is the only credential.** That is a deliberate
 * decision, not an oversight: behind it sits a child's first name, their
 * answers to a free quiz, and a score. No surname, no address, no date of
 * birth, no payment. A login in front of that would cost more conversions than
 * it protects anything, and the whole point of this funnel is that no account
 * exists until a family enrols.
 *
 * What makes it proportionate is the set of rules below, and they are the
 * thing to preserve if this file is ever rewritten:
 *
 *  1. 32 random bytes. Unguessable, and never derived from anything.
 *  2. It expires. After that the page offers a fresh link rather than content.
 *  3. The page carrying it is `noindex` and `no-referrer`, so the token cannot
 *     reach a search engine or a third-party script. See the route.
 *  4. A run never exposes the parent's email or phone. It shows the child's
 *     result and nothing else, whoever opens it.
 *  5. Lookups are rate-limited, so nobody can fish for a valid token.
 */

import { randomBytes } from "node:crypto";

import { and, desc, eq, gt, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { toolRuns } from "@/db/schema";

import { levelCheck, type ToolKey } from "./tools";

/** Long enough that guessing is not a threat model worth modelling. */
const TOKEN_BYTES = 32;

/**
 * Long enough that a child can come back to it after the weekend, and after a
 * parent has been shown it. Short enough that an old link in a forwarded email
 * stops working eventually.
 */
const LIFETIME_DAYS = 90;

export function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export type NewRun = {
  tool: ToolKey;
  /** Set when the teacher issues the link to a family who already enquired. */
  enquiryId?: string | null;
  childFirstName?: string | null;
  childAgeBand?: "8_9" | "10_11" | "any" | null;
};

export async function createRun(input: NewRun) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + LIFETIME_DAYS);

  const [row] = await db
    .insert(toolRuns)
    .values({
      tool: input.tool,
      enquiryId: input.enquiryId ?? null,
      token: newToken(),
      childFirstName: input.childFirstName ?? null,
      childAgeBand: input.childAgeBand ?? null,
      expiresAt,
    })
    .returning();

  return row;
}

/**
 * A run by its token, or undefined.
 *
 * Expiry is part of the lookup rather than a check afterwards, so there is no
 * path through the code that reads an expired run by accident.
 */
export async function findRunByToken(token: string) {
  if (!token || token.length < 20) return undefined;

  return db.query.toolRuns.findFirst({
    where: and(eq(toolRuns.token, token), gt(toolRuns.expiresAt, new Date())),
  });
}

/** Scores a submission and closes the run. Re-submitting is not allowed. */
export async function completeRun(token: string, rawResponses: unknown) {
  const run = await findRunByToken(token);
  if (!run) return { ok: false as const, error: "expired" as const };
  if (run.completedAt) return { ok: true as const, run };

  const parsed = levelCheck.responsesSchema.safeParse(rawResponses);
  if (!parsed.success) {
    return { ok: false as const, error: "bad_input" as const };
  }

  const result = levelCheck.score(parsed.data);

  const [updated] = await db
    .update(toolRuns)
    .set({
      responses: parsed.data,
      result,
      completedAt: new Date(),
    })
    .where(eq(toolRuns.id, run.id))
    .returning();

  return { ok: true as const, run: updated };
}

/**
 * Attaches a finished run to a family.
 *
 * This is the moment the funnel turns anonymous into known — either a parent
 * asking for the full report, or the teacher issuing a link to someone who
 * already enquired. Runs already attached elsewhere are left alone.
 */
export async function attachRunToEnquiry(runId: string, enquiryId: string) {
  await db
    .update(toolRuns)
    .set({ enquiryId })
    .where(and(eq(toolRuns.id, runId), sql`${toolRuns.enquiryId} is null`));
}

/** Every finished run for a family, newest first. For the teacher's screen. */
export async function runsForEnquiry(enquiryId: string) {
  return db
    .select()
    .from(toolRuns)
    .where(eq(toolRuns.enquiryId, enquiryId))
    .orderBy(desc(toolRuns.startedAt));
}

/** Finished runs not yet attached to anyone — the anonymous tail of the funnel. */
export async function unclaimedRuns(limit = 50) {
  return db
    .select()
    .from(toolRuns)
    .where(
      and(sql`${toolRuns.enquiryId} is null`, isNotNull(toolRuns.completedAt)),
    )
    .orderBy(desc(toolRuns.completedAt))
    .limit(limit);
}
