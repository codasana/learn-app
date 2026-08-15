/**
 * Creates and publishes the "Book a free class" form in Automette.
 *
 *   npx tsx scripts/provision-form.ts                 # show what exists
 *   npx tsx scripts/provision-form.ts create          # create and publish
 *   npx tsx scripts/provision-form.ts webhook <url>   # register the receiver
 *
 * The field keys below are the contract. They are what arrives in the
 * `form.submitted` webhook and what `src/app/api/webhooks/automette-form`
 * reads, so they live here in version control rather than in a dashboard
 * where nobody can diff them.
 *
 * Design — theme, colours, layout — is deliberately not set here. That belongs
 * in Automette's builder, and editing it there never disturbs these keys.
 */
import { createRequire } from "node:module";

import { config } from "dotenv";

config({ path: ".env.local" });

const nodeRequire = createRequire(import.meta.url);
const Module = nodeRequire("node:module") as {
  _load: (req: string, parent: unknown, isMain: boolean) => unknown;
};
const load = Module._load;
Module._load = (req, parent, isMain) =>
  req === "server-only" ? {} : load(req, parent, isMain);

const TITLE = "Book a free class";

/**
 * Timezone is asked because half these families are not in India and every
 * class time and reminder is rendered in their zone. Child's surname is not
 * asked, ever — collecting less about a child is a position, not an oversight.
 */
const FIELDS = [
  {
    key: "parent_name",
    type: "text" as const,
    label: "Your name",
    required: true,
  },
  {
    key: "parent_email",
    type: "email" as const,
    label: "Email",
    required: true,
    help: "Where the class link and reminders go.",
  },
  {
    key: "whatsapp",
    type: "tel" as const,
    label: "WhatsApp",
    required: false,
    help: "Optional. Only for reminders — never for marketing.",
  },
  {
    key: "child_first_name",
    type: "text" as const,
    label: "Your child's first name",
    required: false,
    help: "First name is all we need.",
  },
  {
    key: "child_age_band",
    type: "select" as const,
    label: "How old is your child?",
    required: true,
    options: [
      { value: "8_9", label: "8–9 years" },
      { value: "10_11", label: "10–11 years" },
    ],
  },
  {
    key: "child_grade",
    type: "number" as const,
    label: "Which class or grade are they in?",
    required: false,
  },
  {
    key: "timezone",
    type: "select" as const,
    label: "Where are you?",
    required: true,
    help: "So class times are shown in your time, not ours.",
    options: [
      { value: "Asia/Kolkata", label: "India" },
      { value: "Asia/Dubai", label: "UAE / Gulf" },
      { value: "Asia/Singapore", label: "Singapore" },
      { value: "Asia/Riyadh", label: "Saudi Arabia" },
      { value: "Europe/London", label: "United Kingdom" },
      { value: "America/New_York", label: "US — East" },
      { value: "America/Los_Angeles", label: "US — West" },
      { value: "Australia/Sydney", label: "Australia" },
    ],
  },
  {
    key: "message",
    type: "textarea" as const,
    label: "Anything you'd like her to know?",
    required: false,
  },
];

async function main() {
  const a = await import("../src/lib/automette");
  const command = process.argv[2] ?? "status";

  const existing = (await a.listForms()).find((f) => f.title === TITLE);

  if (command === "status") {
    if (!existing) {
      console.log(`No form called "${TITLE}" yet. Run: provision-form create`);
      process.exit(0);
    }
    const form = await a.getForm(existing.id);
    console.log(`${form.title}`);
    console.log(`  id      : ${form.id}`);
    console.log(`  status  : ${form.status} (version ${form.version ?? "—"})`);
    console.log(`  public  : ${form.public_url ?? "not published"}`);
    console.log(`  embed   : ${form.embed_url ?? "not published"}`);
    console.log(`  fields  : ${form.fields?.map((f) => f.key).join(", ")}`);

    const hooks = await a.listFormWebhooks(form.id);
    console.log(
      `  webhooks: ${hooks.length === 0 ? "none" : hooks.map((h) => `${h.url} (${h.active ? "active" : "off"})`).join(", ")}`,
    );
    process.exit(0);
  }

  if (command === "create") {
    if (existing) {
      console.log(
        `"${TITLE}" already exists (${existing.id}). Nothing to do.\n` +
          "Delete it in Automette first if you want a fresh one.",
      );
      process.exit(0);
    }

    const form = await a.createForm({
      title: TITLE,
      description:
        "Half an hour with the teacher, no obligation and nothing to prepare. She'll come back to you with a time that suits your part of the world.",
      submitLabel: "Ask for a class",
      fields: FIELDS,
    });
    console.log(`created  ${form.id}`);

    const published = await a.publishForm(form.id);
    console.log(`published version ${published.version}`);
    console.log(`\n  public : ${published.public_url}`);
    console.log(`  embed  : ${published.embed_url}\n`);
    console.log("Put the embed URL in .env.local as AUTOMETTE_FORM_URL.");
    console.log(
      "Then, once this app is deployed:\n" +
        "  npx tsx scripts/provision-form.ts webhook https://<domain>/api/webhooks/automette-form",
    );
    process.exit(0);
  }

  if (command === "webhook") {
    const url = process.argv[3];
    if (!existing) {
      console.error(`No form called "${TITLE}". Create it first.`);
      process.exit(1);
    }
    if (!url?.startsWith("https://")) {
      console.error("Give an https:// URL for the receiver.");
      process.exit(1);
    }

    const hook = await a.createFormWebhook(existing.id, url);
    console.log(`webhook ${hook.id} → ${hook.url}`);
    console.log(
      `\n  AUTOMETTE_FORM_SECRET=${hook.secret}\n\n` +
        "That secret is shown once and never again. Put it in .env.local now —\n" +
        "without it the receiver cannot verify a single delivery.",
    );
    process.exit(0);
  }

  console.error(`Unknown command "${command}".`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
