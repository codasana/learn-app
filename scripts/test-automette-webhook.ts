/**
 * Signature verification, tested by forging deliveries the way Automette
 * signs them.
 *
 *   npx tsx scripts/test-automette-webhook.ts
 *
 * No network and no Automette. The signing algorithm is copied from their
 * published reference — `${webhook-id}.${webhook-timestamp}.${body}`, HMAC
 * with the base64url-decoded secret, `v1,<base64>` — so a valid delivery can
 * be built locally and every way of getting it wrong can be checked.
 *
 * This is the one piece of the integration that must not be "probably right".
 * The endpoint is unauthenticated by design; the signature IS the
 * authentication, and a check that accepts a forgery accepts anybody.
 */
import { createHmac } from "node:crypto";
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

const SECRET = "wh_" + Buffer.from("a-test-signing-secret").toString("base64url");

/** Exactly what Automette's webhook-delivery does. */
function sign(secret: string, id: string, ts: number, body: string): string {
  const raw = secret.startsWith("wh_") ? secret.slice(3) : secret;
  const mac = createHmac("sha256", Buffer.from(raw, "base64url"))
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
  return `v1,${mac}`;
}

function delivery(body: string, overrides: Record<string, string> = {}) {
  const id = "evt_form_cm4sub9rk0001jt04d2h6w8pn";
  const ts = Math.floor(Date.now() / 1000);
  return new Headers({
    "webhook-id": id,
    "webhook-timestamp": String(ts),
    "webhook-signature": sign(SECRET, id, ts, body),
    ...overrides,
  });
}

async function main() {
  const { parseFormSubmitted, verifyWebhook } = await import(
    "../src/lib/automette-webhooks"
  );

  let failures = 0;
  const check = (label: string, ok: boolean, detail?: string) => {
    if (!ok) failures++;
    console.log(
      `${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`,
    );
  };

  // The real shape, taken from Automette's published example.
  const body = JSON.stringify({
    event_id: "evt_form_cm4sub9rk0001jt04d2h6w8pn",
    event: "form.submitted",
    form_id: "cm4frm3xz0001jw04y7c4m1gh",
    submission_id: "cm4sub9rk0001jt04d2h6w8pn",
    // Copied from a real submission read back through the API. `child_grade`
    // arrives as a NUMBER, not a string — the kind of thing only real data
    // tells you, and the receiver silently dropped it until it did.
    answers: {
      parent_name: "Anita Rao",
      parent_email: "anita@example.com",
      whatsapp: "+971500000000",
      child_first_name: "Nila",
      child_age_band: "8_9",
      child_grade: 3,
      timezone: "Asia/Dubai",
      message: "Evenings suit us best.",
    },
    submitted_at: "2026-08-15T12:00:00.000Z",
  });

  /* --- the happy path ------------------------------------------- */
  const good = verifyWebhook(body, delivery(body), SECRET);
  check("a genuine delivery verifies", good.ok);

  const parsed = parseFormSubmitted(body);
  check(
    "the flat payload parses",
    parsed?.submission_id === "cm4sub9rk0001jt04d2h6w8pn",
    parsed ? `${Object.keys(parsed.answers).length} answers` : "did not parse",
  );
  check(
    "a number answer survives as a number",
    typeof parsed?.answers.child_grade === "number",
    `child_grade is ${typeof parsed?.answers.child_grade}`,
  );

  /* --- the shapes an answer can actually take -------------------- */
  //
  // Automette's typing table: number → number or NULL when left empty,
  // checkbox → boolean, multi_select → array, and a skipped field may be
  // absent from `answers` altogether. An empty number is not 0 and not "".
  {
    const { readAnswers } = await import(
      "../src/app/api/webhooks/automette-form/read-answers"
    );

    const sparse = readAnswers({
      parent_name: "Anita",
      parent_email: "anita@example.com",
      child_grade: null,
      child_age_band: "8_9",
      // whatsapp, child_first_name, message: absent entirely
      timezone: "Asia/Dubai",
    });
    check("an empty number reads as null, not 0", sparse.childGrade === null,
      `got ${JSON.stringify(sparse.childGrade)}`);
    check("an absent field reads as null", sparse.whatsapp === null);
    check("the fields that are there still read", sparse.parentName === "Anita");

    const typed = readAnswers({
      child_grade: 4,
      parent_name: "  Padded  ",
      // types this form does not use, but which must not crash a parser
      consent: true,
      interests: ["reading", "drawing"],
    });
    check("a real number reads through", typed.childGrade === 4);
    check("whitespace is trimmed", typed.parentName === "Padded");
    check(
      "a boolean or array answer does not become a string",
      typed.message === null,
    );
  }

  /* --- every way of being wrong --------------------------------- */
  check(
    "a tampered body is refused",
    !verifyWebhook(body.replace("Anita Rao", "Someone Else"), delivery(body), SECRET)
      .ok,
  );

  check(
    "the wrong secret is refused",
    !verifyWebhook(body, delivery(body), "wh_" + Buffer.from("wrong").toString("base64url")).ok,
  );

  check(
    "a missing signature header is refused",
    !verifyWebhook(
      body,
      new Headers({ "webhook-id": "x", "webhook-timestamp": "1" }),
      SECRET,
    ).ok,
  );

  // Replay: a delivery captured today, replayed next week.
  const old = Math.floor(Date.now() / 1000) - 3600;
  const replay = new Headers({
    "webhook-id": "evt_form_old",
    "webhook-timestamp": String(old),
    "webhook-signature": sign(SECRET, "evt_form_old", old, body),
  });
  const replayed = verifyWebhook(body, replay, SECRET);
  check(
    "a correctly-signed replay is refused on age",
    !replayed.ok,
    replayed.ok ? "" : replayed.reason,
  );

  // A signature valid for a different body — the classic mistake of signing
  // the parsed object rather than the raw bytes.
  const otherBody = JSON.stringify({ event: "form.submitted", submission_id: "x" });
  check(
    "a signature from another body is refused",
    !verifyWebhook(body, delivery(otherBody), SECRET).ok,
  );

  // Re-serialising the same JSON changes byte order and must fail, which is
  // why the route reads req.text() rather than req.json().
  const reserialised = JSON.stringify(JSON.parse(body), Object.keys(JSON.parse(body)).sort());
  check(
    "re-serialised JSON no longer matches",
    !verifyWebhook(reserialised, delivery(body), SECRET).ok,
    "this is why the route signs over the raw body",
  );

  /* --- things that are not our event ----------------------------- */
  check(
    "another event type is not treated as a submission",
    parseFormSubmitted(
      JSON.stringify({ event: "render.completed", render_id: "r1" }),
    ) === null,
  );
  check("nonsense does not throw", parseFormSubmitted("not json{") === null);
  check(
    "a submission with no answers is rejected",
    parseFormSubmitted(
      JSON.stringify({ event: "form.submitted", submission_id: "s1" }),
    ) === null,
  );

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nall checks passed — the endpoint can tell a forgery from a delivery");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
