import "server-only";

import { brand, teacherName, TeacherName } from "@/lib/brand";
import { appUrl, bookingUrl } from "@/lib/booking";
import { ADMIN_EMAIL, sendEmail } from "@/lib/email";

/**
 * The messages this program sends, in one file so the voice can be read in one
 * sitting. src/lib/email.ts is the transport; this is what we actually say.
 *
 * Only the free check needs code. The "Book a free session" form is an Automette
 * form, and Automette already emails the parent a confirmation and the teacher
 * an alert with reply-to set to the parent — duplicating either here would put
 * two near-identical emails in the same inbox. The booking link belongs in
 * BOTH paths, but on that side it goes in the form's confirmation copy rather
 * than in ours.
 *
 * Every send is best-effort. A lead is captured the moment its row is written;
 * losing the email afterwards is a bad day, while throwing here would lose the
 * enquiry itself. So callers save first and notify second, and nothing in this
 * file may throw.
 */

type CheckResult = {
  total: number;
  outOf: number;
  strongest: string;
  sections?: Array<{ label: string; score: number; outOf: number }>;
};

/** The transport is only configured in some environments. Say so, once. */
function canSend(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.EMAIL_FROM,
  );
}

async function trySend(args: Parameters<typeof sendEmail>[0], label: string) {
  if (!canSend()) {
    console.warn(`[notify] ${label} not sent — email is not configured`);
    return;
  }
  try {
    const { id } = await sendEmail(args);
    console.log(`[notify] ${label} sent to ${args.to} (${id ?? "no id"})`);
  } catch (err) {
    // Logged, never thrown: see the file comment.
    console.error(`[notify] ${label} FAILED for ${args.to}`, err);
  }
}

/**
 * What a parent gets after asking for the report.
 *
 * It contains the result and nothing withheld, because that is what the
 * screen said it would contain. The old version promised a hand-written
 * one-page report "in a day or so" — a promise made by software and kept by a
 * person, for a document that does not exist.
 *
 * What Sheeba writes comes AFTER she has met the child, and it is worth
 * waiting for precisely because it cannot be generated. This email does not
 * pre-sell it; it sells the session, which is the thing that produces it.
 */
export function checkResultEmail({
  parentName,
  childFirstName,
  token,
  result,
}: {
  parentName: string;
  childFirstName: string | null;
  token: string;
  result: CheckResult;
}): { subject: string; text: string } {
  const who = childFirstName ?? "your child";
  const Who = childFirstName ?? "Your child";
  const book = bookingUrl();

  // Padded so the numbers line up in a monospaced mail client and still read
  // sensibly in a proportional one.
  const width = Math.max(...(result.sections ?? []).map((s) => s.label.length), 0);
  const breakdown = (result.sections ?? [])
    .map((s) => `  ${s.label.padEnd(width)}   ${s.score} out of ${s.outOf}`)
    .join("\n");

  const next = book
    ? `The next step is a free session with ${teacherName()} — half an hour
talking with ${who}, getting a proper sense of where they are, and an honest
answer on whether this is the right thing for them, including when it isn't.

Pick a time that suits you. The times you see are in your own timezone:

  ${book}

Nothing to pay and nothing to prepare.`
    : `The next step is a free session with ${teacherName()} — half an hour
talking with ${who}, getting a proper sense of where they are, and an honest
answer on whether this is the right thing for them, including when it isn't.
You will hear shortly with a few times that work where you are.

Nothing to pay and nothing to prepare.`;

  const text = `Hello ${parentName},

${Who} finished the check: ${result.total} out of ${result.outOf}.

${breakdown}

Strongest area: ${result.strongest}.

That is a rough picture rather than a verdict — seventeen questions can only
say so much, and none of it involves anyone having met ${who}. What it is good
for is telling ${teacherName()} where to begin.

${next}

The result stays here, if you would like to look at it again:

  ${appUrl(`/check/${token}`)}

— ${brand.name}
`;

  return { subject: `${Who}'s check result`, text };
}

export async function sendCheckResult(
  args: Parameters<typeof checkResultEmail>[0] & { to: string },
) {
  await trySend(
    {
      to: args.to,
      ...checkResultEmail(args),
      fromName: brand.name,
      // She replies from her own mail client and it reaches the parent.
      replyTo: process.env.TEACHER_EMAIL ?? ADMIN_EMAIL,
    },
    "check result",
  );
}

/**
 * Sheeba sending a family the check, before or after their session.
 *
 * Short on purpose. This one is from a person — she has usually spoken to
 * them, or is about to — so it reads as a note rather than a campaign, and it
 * carries one link and one instruction.
 */
export function toolLinkEmail({
  parentName,
  childFirstName,
  url,
}: {
  parentName: string | null;
  childFirstName: string | null;
  url: string;
}): { subject: string; text: string } {
  const who = childFirstName ?? "your child";

  const text = `${parentName ? `Hello ${parentName},` : "Hello,"}

Here is the short English check for ${who}. It takes about twelve minutes,
there is nothing to prepare, and it needs no sign-up — the link is already
tied to you, so nobody will be asked for an email again.

  ${url}

It works best if ${who} does it alone, in one sitting. There is no pass mark
and nothing rides on it: it just tells me where to begin.

— ${TeacherName()}
`;

  return {
    subject: `A short English check for ${childFirstName ?? "your child"}`,
    text,
  };
}

export async function sendToolLink(
  args: Parameters<typeof toolLinkEmail>[0] & { to: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!canSend()) {
    return { ok: false, error: "Email isn't configured on this server." };
  }
  try {
    const { subject, text } = toolLinkEmail(args);
    await sendEmail({
      to: args.to,
      subject,
      text,
      fromName: brand.name,
      replyTo: process.env.TEACHER_EMAIL ?? ADMIN_EMAIL,
    });
    return { ok: true };
  } catch (err) {
    /*
     * The one send that DOES report failure.
     *
     * Everything else here is a side effect of something the user already
     * achieved — the enquiry is saved whether or not the mail goes. This one
     * IS the action: Sheeba pressed a button meaning "send it", and telling
     * her it worked when it did not means a family silently never hears from
     * her.
     */
    console.error("[notify] tool link FAILED", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "That didn't send.",
    };
  }
}

/**
 * The teacher's copy. Automette covers the other path; this covers the check.
 *
 * It carries the score, because whether a lead is worth answering tonight or
 * on Monday is mostly decided by it, and a link straight to the enquiry so
 * nobody has to go hunting for the row.
 */
export async function sendEnquiryAlert({
  enquiryId,
  parentName,
  parentEmail,
  whatsapp,
  childFirstName,
  result,
}: {
  enquiryId: string;
  parentName: string;
  parentEmail: string;
  whatsapp?: string | null;
  childFirstName: string | null;
  result: CheckResult;
}) {
  const who = childFirstName ?? "a child";

  const text = `${parentName} asked for the report after ${who} took the free check.

  Score      ${result.total} out of ${result.outOf}
  Strongest  ${result.strongest}
  Child      ${childFirstName ?? "not given"}
  Email      ${parentEmail}
  WhatsApp   ${whatsapp || "not given"}

They have been sent the result and the booking link. Nothing is needed from
you until they book, beyond the one-page report.

  ${appUrl(`/teacher/enquiries/${enquiryId}`)}
`;

  await trySend(
    {
      to: process.env.TEACHER_EMAIL ?? ADMIN_EMAIL,
      subject: `Free check — ${childFirstName ?? parentName} (${result.total}/${result.outOf})`,
      text,
      fromName: brand.name,
      replyTo: parentEmail,
    },
    "enquiry alert",
  );
}
