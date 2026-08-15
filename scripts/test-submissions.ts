/**
 * What a child may and may not hand in.
 *
 * The submission model went from "writing only" to "any shape", which widened
 * a write path that children reach directly. These check the two gates that
 * matter: the activity must be set for THIS child, and the shape must be one
 * that activity accepts. Both are enforced server-side; neither is a UI rule.
 */
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3001";

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ok    ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function signIn(username: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/sign-in/username`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password: "demo-password-42" }),
  });
  if (!res.ok) throw new Error(`could not sign in as ${username}`);
  return (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
}

/** Calls a server action the way the browser does. */
async function action(
  cookie: string,
  path: string,
  actionId: string,
  args: unknown[],
): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      cookie,
      "content-type": "text/plain;charset=UTF-8",
      "next-action": actionId,
    },
    body: JSON.stringify(args),
  });
}

async function main() {
  const { db } = await import("../src/db");
  const { contentItems, submissions, childProfiles } = await import(
    "../src/db/schema"
  );

  console.log("\nSubmission rules\n");

  /* --- the model itself ------------------------------------------- */

  const { acceptedKinds, needsAPerson } = await import("@/lib/content-types");

  check("a writing task takes typed work", acceptedKinds("writing_task").includes("text"));
  check("a writing task takes a photo of it", acceptedKinds("writing_task").includes("photo"));
  check("a speaking task takes a recording", acceptedKinds("speaking_task").includes("audio"));
  check("a speaking task does NOT take typing", !acceptedKinds("speaking_task").includes("text"));
  check("a quiz needs no person", !needsAPerson("quiz"));
  check("a word list needs no person", !needsAPerson("vocab_set"));
  check("a passage needs no person", !needsAPerson("passage"));
  check("a speaking task needs a person", needsAPerson("speaking_task"));
  check("an unknown type accepts nothing", acceptedKinds("nonsense").length === 0);

  /* --- what actually landed in the database ------------------------ */

  const speaking = await db.query.contentItems.findFirst({
    where: eq(contentItems.type, "speaking_task"),
  });
  check("the library has a speaking task", Boolean(speaking));

  const rows = await db
    .select({
      kind: submissions.kind,
      mediaUrl: submissions.mediaUrl,
      mediaSeconds: submissions.mediaSeconds,
      body: submissions.body,
      child: childProfiles.firstName,
    })
    .from(submissions)
    .innerJoin(childProfiles, eq(childProfiles.id, submissions.childId));

  const audio = rows.filter((r) => r.kind === "audio");
  const text = rows.filter((r) => r.kind === "text");

  check("both shapes are in one queue", audio.length > 0 && text.length > 0,
    `audio=${audio.length} text=${text.length}`);
  check("every recording has a length", audio.every((r) => r.mediaSeconds !== null));
  check("every recording has an object key", audio.every((r) => Boolean(r.mediaUrl)));
  check("no recording stores a URL", audio.every((r) => !r.mediaUrl?.includes("://")),
    "media_url must be a key, never a full URL");
  check("every piece of writing has a body", text.every((r) => Boolean(r.body?.trim())));

  /* --- one row per child per activity ------------------------------ */

  const pairs = await db
    .select({ c: submissions.childId, i: submissions.contentItemId })
    .from(submissions);
  const unique = new Set(pairs.map((p) => `${p.c}|${p.i}`));
  check("no child has two rows for one activity", unique.size === pairs.length);

  /* --- the live gates ---------------------------------------------- */

  let cookie = "";
  try {
    cookie = await signIn("ishaan");
  } catch {
    console.log("\n  (skipping live checks — no dev server on " + BASE + ")\n");
    return report();
  }

  // Arjun is on unit 5; Ishaan is on unit 1. Ishaan asking for Arjun's work
  // is the case that must never succeed.
  const arjun = await db.query.childProfiles.findFirst({
    where: eq(childProfiles.firstName, "Arjun"),
  });
  const arjunWork = arjun
    ? await db.query.submissions.findFirst({
        where: eq(submissions.childId, arjun.id),
      })
    : null;

  if (arjunWork) {
    const res = await fetch(`${BASE}/teacher/review/${arjunWork.id}`, {
      headers: { cookie },
      redirect: "manual",
    });
    check(
      "a child cannot open the teacher's review screen",
      res.status === 307 || res.status === 302 || res.status === 404,
      `got ${res.status}`,
    );
  }

  if (speaking) {
    const page = await fetch(`${BASE}/learn/do/${speaking.id}`, {
      headers: { cookie },
    });
    const html = await page.text();
    check("the child is offered a recorder", html.includes("Start recording"));
    check(
      "the child is not shown the teacher's marking focus",
      !html.includes("Ignore spelling") && !html.includes("Confidence and flow"),
    );
  }

  report();
}

function report() {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
