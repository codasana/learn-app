import "server-only";

import { brand } from "@/lib/brand";
import { appUrl, bookingUrl } from "@/lib/booking";
import { ADMIN_EMAIL, sendEmail } from "@/lib/email";

/**
 * The messages this program sends, in one file so the voice can be read in one
 * sitting. src/lib/email.ts is the transport; this is what we actually say.
 *
 * Only the free check needs code. The "Book a free class" form is an Automette
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

type CheckResult = { total: number; outOf: number; strongest: string };

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
 * It leads with the class, not the report. The class is the thing we can
 * deliver this minute — a link she can book in her own timezone — while the
 * report is written by hand and takes a day. Leading with the slower half
 * would waste the one moment this parent is actually paying attention.
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

  const next = book
    ? `The useful next step is a free 30-minute class with Sheeba. She will talk
to ${who}, get a proper sense of where they are, and tell you honestly whether
this is the right thing for them.

Pick a time that suits you — the times you see are in your own timezone:

  ${book}

There is nothing to pay and nothing to prepare.`
    : `The useful next step is a free 30-minute class with Sheeba. She will talk
to ${who}, get a proper sense of where they are, and tell you honestly whether
this is the right thing for them. She will write to you shortly with a few
times that work where you are.

There is nothing to pay and nothing to prepare.`;

  const text = `Hello ${parentName},

${Who} finished the check: ${result.total} out of ${result.outOf}, strongest area ${result.strongest}.

That number is a starting point rather than a verdict. It tells us roughly
where to begin and very little else — which is why the next bit matters more.

${next}

Sheeba reads every check herself and writes a one-page report to go with it:
what ${who} did well, what to work on next, and where they would start. It
follows in a day or so.

The result itself stays here, if you would like to look again:

  ${appUrl(`/check/${token}`)}

— ${brand.name}
`;

  return { subject: `${Who}'s check result — and a free class`, text };
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
