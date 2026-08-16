/**
 * The "Book a free class" form's own copy, pushed through the Automette API.
 *
 * This lives in a script rather than being clicked into a dashboard because
 * it is the only part of the funnel's wording that is NOT in this repository,
 * and copy nobody can grep for is copy nobody remembers to change. The form
 * is a lead capture, not a calendar — the booking link goes in the reply, so
 * the address is ours before the timeslot is theirs.
 *
 * We are a CUSTOMER of Automette: public API only, never its database.
 *
 *   npx tsx scripts/set-form-copy.ts --dry-run   # show what would change
 *   npx tsx scripts/set-form-copy.ts             # apply it
 */
import { config } from "dotenv";

import { teacherName, TeacherName } from "../src/lib/brand";

config({ path: ".env.local", quiet: true });

const BASE = process.env.AUTOMETTE_API_BASE;
const KEY = process.env.AUTOMETTE_API_KEY;
const FORM = process.env.AUTOMETTE_FORM_ID;

function confirmationMessage(booking: string | null): string {
  if (!booking) {
    return `Thank you for asking.

${TeacherName()} reads every one of these personally, so it may take a
day before you hear back. You will then be offered a few times that work
where you are — not where we are.

There is nothing to pay and nothing to prepare. The first session is free,
and if it turns out we are not the right fit you will be told so.`;
  }

  return `Thank you for asking.

You can pick a time right now, if you would like to. It is a free session
with ${teacherName()}, half an hour — a proper conversation with your child,
a sense of where they are, and an honest answer on whether this is the
right thing for them, including when it isn't.

  ${booking}

The times you see are in your own timezone. Nothing to pay and nothing
to prepare.

If none of them suit, just reply to this email and ${teacherName()} will
find something that does. Every one of these is read personally.`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!BASE || !KEY || !FORM) {
    console.error("AUTOMETTE_API_BASE, AUTOMETTE_API_KEY and AUTOMETTE_FORM_ID must be set.");
    process.exit(1);
  }

  const booking = process.env.CAL_BOOKING_URL?.trim() || null;
  if (!booking) {
    console.log("CAL_BOOKING_URL is not set — writing the no-link wording.\n");
  }

  const message = confirmationMessage(booking);

  const current = await fetch(`${BASE}/forms/${FORM}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!current.ok) {
    console.error(`Could not read the form: ${current.status}`);
    process.exit(1);
  }
  const form = (await current.json()) as {
    title: string;
    respondent_confirmation?: { message?: string };
  };

  console.log(`Form: ${form.title}\n`);
  console.log("--- currently ---");
  console.log(form.respondent_confirmation?.message ?? "(none)");
  console.log("\n--- would become ---");
  console.log(message);

  if (dryRun) {
    console.log("\nDry run. Nothing changed.");
    process.exit(0);
  }

  if (form.respondent_confirmation?.message === message) {
    console.log("\nAlready says exactly this. Nothing to do.");
    process.exit(0);
  }

  const res = await fetch(`${BASE}/forms/${FORM}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      respondent_confirmation: {
        email_field: "parent_email",
        subject: booking ? "We have your request — pick a time" : "We have your request",
        message,
      },
    }),
  });

  if (!res.ok) {
    console.error(`\nPATCH failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  console.log("\nUpdated.");
  process.exit(0);
}

main();
