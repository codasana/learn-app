/**
 * The lead pipeline: stage mapping, Cal.com signatures, and the sync gate.
 *
 * The parts that can be checked without a Loops key or a Cal.com account are
 * checked here. What CANNOT be verified from this machine is the shape Loops
 * accepts on the wire — that needs a real key, and the run below says so
 * plainly rather than passing silently and implying otherwise.
 */
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";

import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const nodeRequire = createRequire(import.meta.url);
const Module = nodeRequire("node:module") as {
  _load: (req: string, parent: unknown, isMain: boolean) => unknown;
};
const load = Module._load;
Module._load = (req, parent, isMain) =>
  req === "server-only" ? {} : load(req, parent, isMain);

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

const SECRET = "test-cal-secret";

function signed(body: unknown, secret = SECRET) {
  const raw = JSON.stringify(body);
  const sig = createHmac("sha256", secret).update(raw).digest("hex");
  return { raw, headers: new Headers({ "x-cal-signature-256": sig }) };
}

function booking(trigger: string, over: Record<string, unknown> = {}) {
  return {
    triggerEvent: trigger,
    payload: {
      uid: "bk_abc123",
      startTime: "2026-12-07T11:30:00.000Z",
      attendees: [
        { email: "Parent@Example.com", name: "A Parent", timeZone: "Asia/Dubai" },
      ],
      ...over,
    },
  };
}

async function main() {
  const { stageFor } = await import("../src/lib/leads");
  const { verifyCalWebhook, parseCalBooking } = await import(
    "../src/lib/cal-webhooks"
  );
  const { loopsReady, testKey } = await import("../src/lib/loops");

  console.log("\nLead stages\n");

  check("a new enquiry is 'enquired'", stageFor("new") === "enquired");
  check("a booked class is 'class_booked'", stageFor("class_scheduled") === "class_booked");
  check("an enrolment is 'customer'", stageFor("enrolled") === "customer");
  check("declined stays 'declined'", stageFor("declined") === "declined");
  check(
    "no stage leaks a raw column name a marketer would misread",
    stageFor("new") !== "new",
  );

  console.log("\nCal.com signatures\n");

  const good = signed(booking("BOOKING_CREATED"));
  check("a correctly signed body verifies", verifyCalWebhook(good.raw, good.headers, SECRET).ok);

  check(
    "a body altered after signing is refused",
    !verifyCalWebhook(good.raw + " ", good.headers, SECRET).ok,
  );

  const wrong = signed(booking("BOOKING_CREATED"), "not-the-secret");
  check(
    "another sender's secret is refused",
    !verifyCalWebhook(wrong.raw, wrong.headers, SECRET).ok,
  );

  check(
    "a missing signature header is refused",
    !verifyCalWebhook(good.raw, new Headers(), SECRET).ok,
  );

  console.log("\nCal.com payloads\n");

  const created = parseCalBooking(JSON.stringify(booking("BOOKING_CREATED")));
  check("a booking parses", created !== null);
  check("the attendee email is lower-cased", created?.attendeeEmail === "parent@example.com");
  check("the booking uid is kept", created?.bookingId === "bk_abc123");
  check("the attendee's own timezone is kept", created?.attendeeTimezone === "Asia/Dubai");

  check(
    "a cancellation parses",
    parseCalBooking(JSON.stringify(booking("BOOKING_CANCELLED")))?.trigger ===
      "BOOKING_CANCELLED",
  );
  check(
    "an event we do not handle is ignored",
    parseCalBooking(JSON.stringify(booking("MEETING_ENDED"))) === null,
  );
  check(
    "a booking with no start time is ignored",
    parseCalBooking(JSON.stringify(booking("BOOKING_CREATED", { startTime: undefined }))) === null,
  );
  check("nonsense is ignored", parseCalBooking("not json") === null);

  const noAttendee = parseCalBooking(
    JSON.stringify(booking("BOOKING_CREATED", { attendees: [] })),
  );
  check("a booking with no attendee still parses", noAttendee !== null);
  check("...but carries no email to match on", noAttendee?.attendeeEmail === null);

  console.log("\nLoops\n");

  if (!loopsReady()) {
    console.log("  ---   LOOPS_API_KEY is not set.");
    console.log("        Every sync is a no-op and the wire format is UNVERIFIED.");
  } else {
    const key = await testKey();
    check("the API key is accepted", key.ok, key.ok ? "" : key.error);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
