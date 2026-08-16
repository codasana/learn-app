"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { enquiries, toolRuns } from "@/db/schema";
import { bookingUrlFor } from "@/lib/booking";
import { syncLeadById } from "@/lib/leads";
import { sendCheckResult, sendEnquiryAlert } from "@/lib/notify";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { attachRunToEnquiry, completeRun, createRun } from "@/lib/tool-runs";
import { levelCheck } from "@/lib/tools";

/**
 * Starting the check. No account, no email, no consent gate — that is the
 * whole advantage of the tool and the reason cold traffic uses it at all.
 */
export async function startCheck(formData: FormData) {
  const h = await headers();
  const limit = rateLimit(clientKey(h, "start-check"), {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.ok) redirect("/check?busy=1");

  const firstName = String(formData.get("childFirstName") ?? "").trim();

  const run = await createRun({
    tool: "level_check",
    // First name only, and even that is optional. It exists so the result can
    // say "Nila got 12 out of 17" instead of "you got 12 out of 17".
    childFirstName: firstName.slice(0, 40) || null,
  });

  redirect(`/check/${run.token}`);
}

export async function submitCheck(token: string, answers: unknown) {
  const h = await headers();
  const limit = rateLimit(clientKey(h, "submit-check"), {
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.ok) return { ok: false as const, error: "busy" as const };

  const result = await completeRun(token, { answers });
  if (!result.ok) return result;
  return { ok: true as const };
}

const reportRequest = z.object({
  parentName: z.string().trim().min(1, "Please add a name."),
  parentEmail: z.string().trim().email("That email doesn't look right."),
  whatsapp: z.string().trim().optional(),
});

/**
 * The one ask on the result page: a way to reach a parent, in exchange for a
 * free session.
 *
 * The booking link is NEVER returned to the browser, on this page or any
 * other. A calendar reachable from the site converts the few ready to book
 * this second and loses everyone else without trace; going through the inbox
 * means every person who wants a time is a lead we hold first, and can follow
 * up if they go quiet.
 *
 * So the link exists only inside the email, and it carries the enquiry id —
 * which is what ties a Cal.com booking back to this check rather than leaving
 * the webhook guessing by email address.
 *
 * The run may already belong to a family — the teacher can issue a link to
 * someone who has already enquired — in which case there is nothing to ask
 * for and nothing to create.
 */
export async function requestReport(token: string, formData: FormData) {
  const h = await headers();
  const limit = rateLimit(clientKey(h, "request-report"), {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.ok) return { ok: false as const, error: "Please try again in a bit." };

  const run = await db.query.toolRuns.findFirst({
    where: eq(toolRuns.token, token),
  });
  if (!run || !run.completedAt) {
    return { ok: false as const, error: "Finish the check first." };
  }
  if (run.enquiryId) return { ok: true as const };

  const parsed = reportRequest.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  const [enquiry] = await db
    .insert(enquiries)
    .values({
      parentName: v.parentName,
      parentEmail: v.parentEmail.toLowerCase(),
      whatsapp: v.whatsapp || null,
      childFirstName: run.childFirstName,
      childAgeBand: run.childAgeBand,
      source: "tool",
      status: "new",
    })
    .returning({ id: enquiries.id });

  await attachRunToEnquiry(run.id, enquiry.id);

  /*
   * Saved first, told second, and never the other way round.
   *
   * A lead exists the moment its row is written. If SES is down, or the
   * address bounces, or the whole of eu-west-1 is having an afternoon, the
   * family is still in the pipeline and Sheeba can pick them up by hand —
   * so nothing below is allowed to fail this action. sendCheckResult and
   * sendEnquiryAlert swallow their own errors for the same reason.
   */
  // Server-side only. This never crosses to the client — see above.
  const booking = bookingUrlFor({
    enquiryId: enquiry.id,
    name: v.parentName,
    email: v.parentEmail.toLowerCase(),
  });

  const parsedResult = levelCheck.resultSchema.safeParse(run.result);
  if (parsedResult.success) {
    const partial = levelCheck.partialResult(parsedResult.data);
    await sendCheckResult({
      to: v.parentEmail.toLowerCase(),
      parentName: v.parentName,
      childFirstName: run.childFirstName,
      token,
      result: partial,
      bookingUrl: booking,
    });
    await sendEnquiryAlert({
      enquiryId: enquiry.id,
      parentName: v.parentName,
      parentEmail: v.parentEmail.toLowerCase(),
      whatsapp: v.whatsapp,
      childFirstName: run.childFirstName,
      result: partial,
    });
  }

  await syncLeadById(enquiry.id);

  return { ok: true as const };
}
