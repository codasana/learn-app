/**
 * A term in progress, so every screen has something real on it.
 *
 *   npx tsx scripts/seed-demo.ts          # add the demo term
 *   npx tsx scripts/seed-demo.ts --reset  # remove it and start again
 *
 * Run scripts/seed-week1.ts first — this builds on that syllabus.
 *
 * Everything here is deliberately uneven. Five families who all started on the
 * same day and are all on unit 3 would make the app look finished and tell you
 * nothing. These children are at different units, in four timezones, on
 * different numbers of classes a week, with different amounts done — one has
 * barely started, one has fallen behind, one is racing.
 *
 * Every account uses @demo.invalid, which is how --reset finds them. Nothing
 * outside that domain is ever touched.
 */
import { createRequire } from "node:module";

import { config } from "dotenv";
import { and, eq, like } from "drizzle-orm";

config({ path: ".env.local" });

const nodeRequire = createRequire(import.meta.url);
const Module = nodeRequire("node:module") as {
  _load: (req: string, parent: unknown, isMain: boolean) => unknown;
};
const load = Module._load;
Module._load = (req, parent, isMain) =>
  req === "server-only" ? {} : load(req, parent, isMain);

const DEMO = "@demo.invalid";
const PASSWORD = "demo-password-42";

type Family = {
  parent: string;
  email: string;
  whatsapp: string;
  timezone: string;
  child: string;
  avatar: string;
  ageBand: "8_9" | "10_11";
  username: string;
  /** Which unit Sheeba has moved them to. */
  unit: number;
  /** Weekdays, 0 = Sunday. */
  days: number[];
  time: string;
  durationMin: number;
  /** How much of this unit's practice they have actually done. */
  diligence: "none" | "some" | "most" | "all";
  note: string;
};

const FAMILIES: Family[] = [
  {
    parent: "Anita Rao",
    email: `anita${DEMO}`,
    whatsapp: "+91 98200 11111",
    timezone: "Asia/Kolkata",
    child: "Nila",
    avatar: "otter",
    ageBand: "8_9",
    username: "nila",
    unit: 3,
    days: [1, 4],
    time: "17:00",
    durationMin: 45,
    diligence: "most",
    note: "Doing well. Reads aloud confidently now.",
  },
  {
    parent: "Faisal Khan",
    email: `faisal${DEMO}`,
    whatsapp: "+971 50 222 2222",
    timezone: "Asia/Dubai",
    child: "Zara",
    avatar: "penguin",
    ageBand: "8_9",
    username: "zara",
    unit: 2,
    days: [2, 5],
    time: "18:00",
    durationMin: 45,
    diligence: "some",
    note: "Shy at first, opening up. Parents keen on speaking practice.",
  },
  {
    parent: "Priya Menon",
    email: `priya${DEMO}`,
    whatsapp: "+65 8123 3333",
    timezone: "Asia/Singapore",
    child: "Arjun",
    avatar: "fox",
    ageBand: "10_11",
    username: "arjun",
    unit: 5,
    days: [1, 3, 5],
    time: "19:30",
    durationMin: 45,
    diligence: "all",
    note: "Three classes a week. Moving faster than the others — skipped unit 4.",
  },
  {
    parent: "Sarah Thomas",
    email: `sarah${DEMO}`,
    whatsapp: "+44 7700 900444",
    timezone: "Europe/London",
    child: "Kabir",
    avatar: "panda",
    ageBand: "10_11",
    username: "kabir",
    unit: 2,
    days: [6],
    time: "08:00",
    durationMin: 60,
    diligence: "none",
    note: "One long class on Saturdays. Has not touched the app between classes.",
  },
  {
    parent: "Meera Shah",
    email: `meera${DEMO}`,
    whatsapp: "+91 99300 55555",
    timezone: "Asia/Kolkata",
    child: "Ishaan",
    avatar: "rabbit",
    ageBand: "8_9",
    username: "ishaan",
    unit: 1,
    days: [3, 6],
    time: "16:00",
    durationMin: 45,
    diligence: "some",
    note: "Just started this week.",
  },
];

/** Themes for the units beyond week 1, so the app is not full of blanks. */
const UNIT_THEMES: [number, string, string][] = [
  [2, "My Family", "he / she / they + has / have"],
  [3, "My School Day", "simple present, daily routine"],
  [4, "Things I Like", "like / love / enjoy + -ing"],
  [5, "My Favourite Place", "there is / there are"],
  [6, "A Day Out", "past simple — went, saw, ate"],
];

async function main() {
  const reset = process.argv.includes("--reset");

  const { db } = await import("../src/db");
  const s = await import("../src/db/schema");
  const { createAccount } = await import("../src/lib/create-account");
  const { createChildLogin } = await import("../src/lib/child-accounts");
  const { occurrences } = await import("../src/lib/scheduling");
  const { addDays, dateIn, isoDate } = await import("../src/lib/time").then(
    async (m) => ({ ...m, isoDate: (await import("../src/lib/leitner")).isoDate }),
  );

  /* --- clear anything from a previous run ------------------------- */
  const demoParents = await db
    .select()
    .from(s.users)
    .where(like(s.users.email, `%${DEMO}`));

  for (const p of demoParents) {
    const kids = await db
      .select()
      .from(s.childProfiles)
      .where(eq(s.childProfiles.parentId, p.id));

    for (const k of kids) {
      const enrols = await db
        .select({ id: s.enrollments.id })
        .from(s.enrollments)
        .where(eq(s.enrollments.childId, k.id));
      for (const e of enrols) {
        await db
          .delete(s.scheduledClasses)
          .where(eq(s.scheduledClasses.enrollmentId, e.id));
      }
      await db.delete(s.submissions).where(eq(s.submissions.childId, k.id));
      await db.delete(s.activityCompletions).where(eq(s.activityCompletions.childId, k.id));
      await db.delete(s.cardStates).where(eq(s.cardStates.childId, k.id));
      await db.delete(s.dailyProgress).where(eq(s.dailyProgress.childId, k.id));
      await db.delete(s.enrollments).where(eq(s.enrollments.childId, k.id));
      if (k.userId) await db.delete(s.users).where(eq(s.users.id, k.userId));
    }
    await db.delete(s.childProfiles).where(eq(s.childProfiles.parentId, p.id));
    await db.delete(s.users).where(eq(s.users.id, p.id));
  }
  await db.delete(s.enquiries).where(like(s.enquiries.parentEmail, `%${DEMO}`));

  if (reset) {
    console.log("demo data removed");
    process.exit(0);
  }

  /* --- the syllabus this all hangs off ---------------------------- */
  const syllabus = await db.query.syllabi.findFirst({
    where: eq(s.syllabi.name, "Level 1 · Foundations"),
  });
  if (!syllabus) {
    console.error("Run scripts/seed-week1.ts first — no syllabus to enrol into.");
    process.exit(1);
  }
  await db
    .update(s.syllabi)
    .set({ status: "published" })
    .where(eq(s.syllabi.id, syllabus.id));

  for (const [position, theme, grammar] of UNIT_THEMES) {
    await db
      .update(s.syllabusUnits)
      .set({ theme, grammarFocus: grammar })
      .where(
        and(
          eq(s.syllabusUnits.syllabusId, syllabus.id),
          eq(s.syllabusUnits.position, position),
        ),
      );
  }

  const teacher = await db.query.users.findFirst({
    where: eq(s.users.email, "msahajwani@gmail.com"),
  });

  const vocabItem = await db.query.contentItems.findFirst({
    where: eq(s.contentItems.type, "vocab_set"),
  });
  const writingTask = await db.query.contentItems.findFirst({
    where: eq(s.contentItems.type, "writing_task"),
  });
  const speakingTask = await db.query.contentItems.findFirst({
    where: eq(s.contentItems.type, "speaking_task"),
  });
  const practiceItems = await db
    .select()
    .from(s.contentItems)
    .where(eq(s.contentItems.audience, "student"));

  const today = new Date();
  const logins: string[] = [];

  for (const f of FAMILIES) {
    /* --- the family ---------------------------------------------- */
    const parent = await createAccount({
      email: f.email,
      name: f.parent,
      password: PASSWORD,
      role: "parent",
      timezone: f.timezone,
      whatsapp: f.whatsapp,
    });

    const [child] = await db
      .insert(s.childProfiles)
      .values({
        parentId: parent.id,
        firstName: f.child,
        ageBand: f.ageBand,
        avatar: f.avatar,
      })
      .returning({ id: s.childProfiles.id });

    await createChildLogin({
      parentId: parent.id,
      childId: child.id,
      username: f.username,
      password: PASSWORD,
    });

    /* --- enrolled, mid-term -------------------------------------- */
    const started = addDays(dateIn("Asia/Kolkata", today), -21);
    const [enrolment] = await db
      .insert(s.enrollments)
      .values({
        childId: child.id,
        syllabusId: syllabus.id,
        teacherId: teacher?.id ?? null,
        startDate: started,
        currentUnit: f.unit,
        slotDays: f.days,
        slotTime: f.time,
        slotTimezone: "Asia/Kolkata",
        durationMin: f.durationMin,
        meetingUrl: `https://meet.google.com/demo-${f.username}`,
      })
      .returning({ id: s.enrollments.id });

    /* --- three weeks of classes behind, six ahead ----------------- */
    const from = addDays(dateIn("Asia/Kolkata", today), -21);
    const to = addDays(dateIn("Asia/Kolkata", today), 42);
    const planned = occurrences(
      {
        days: f.days,
        time: f.time,
        timezone: "Asia/Kolkata",
        durationMin: f.durationMin,
      },
      from,
      to,
    );

    for (const p of planned) {
      const past = p.startsAt < today;
      // One missed class each, for the family that has one.
      const missed =
        past && f.diligence === "none" && p.startsAt > new Date(Date.now() - 9 * 864e5);

      const [sc] = await db
        .insert(s.scheduledClasses)
        .values({
          enrollmentId: enrolment.id,
          teacherId: teacher?.id ?? null,
          startsAt: p.startsAt,
          durationMin: p.durationMin,
          meetingUrl: `https://meet.google.com/demo-${f.username}`,
          status: past ? (missed ? "completed" : "completed") : "scheduled",
        })
        .returning({ id: s.scheduledClasses.id });

      if (past) {
        await db.insert(s.attendance).values({
          scheduledClassId: sc.id,
          childId: child.id,
          status: missed ? "absent" : "present",
        });
      }
    }

    /* --- practice, to whatever extent they have done it ----------- */
    const howMuch = { none: 0, some: 0.35, most: 0.75, all: 1 }[f.diligence];

    if (vocabItem) {
      const body = vocabItem.body as { words?: { word: string }[] };
      const words = body.words ?? [];
      const doneCount = Math.round(words.length * howMuch);

      for (const [i, w] of words.entries()) {
        if (i >= doneCount) continue;
        const box = 1 + (i % 4);
        await db
          .insert(s.cardStates)
          .values({
            childId: child.id,
            wordKey: w.word.toLowerCase(),
            sourceItemId: vocabItem.id,
            box,
            dueDate: addDays(isoDate(today), box),
            totalReviews: 2 + (i % 3),
            totalCorrect: 1 + (i % 3),
            correctStreak: i % 3,
            isMastered: box >= 5,
            lastReviewedAt: today,
          })
          .onConflictDoNothing();
      }
    }

    for (const [i, item] of practiceItems.entries()) {
      if (item.type === "vocab_set" || item.type === "writing_task") continue;
      if (i / practiceItems.length > howMuch) continue;
      await db.insert(s.activityCompletions).values({
        childId: child.id,
        kind: item.type === "passage" ? "reading" : item.type === "quiz" ? "quiz" : "sentence_builder",
        contentItemId: item.id,
        score: 4 + (i % 3),
        total: 6,
      });
    }

    /* --- handed in: some waiting, some answered ------------------- */
    if (writingTask && f.diligence !== "none") {
      const answered = f.diligence === "all";
      await db.insert(s.submissions).values({
        childId: child.id,
        contentItemId: writingTask.id,
        kind: "text",
        body:
          f.child === "Arjun"
            ? "My name is Arjun. I am ten years old and I live in Singapore. I like cricket and I play it every Saturday with my friends."
            : `My name is ${f.child}. i am eight years old and i live with my family\nI like drawing`,
        status: answered ? "released" : "submitted",
        teacherFeedback: answered
          ? "Three clear sentences and I could picture all of them. Your capital letters were right every time this week — well done. Next time try one longer sentence using 'because'."
          : null,
        releasedAt: answered ? new Date() : null,
        submittedAt: new Date(Date.now() - (answered ? 5 : 2) * 864e5),
      });
    }

    /*
     * A recording, so the review queue holds more than prose. The object key
     * is a placeholder — no audio has been uploaded yet, so the player on the
     * review screen will not have anything to play. Everything around it (the
     * queue, the wait, the reply) is real.
     */
    if (speakingTask && (f.child === "Nila" || f.child === "Zara")) {
      await db.insert(s.submissions).values({
        childId: child.id,
        contentItemId: speakingTask.id,
        kind: "audio",
        mediaUrl: `submissions/demo/${f.username}-family.webm`,
        mediaSeconds: f.child === "Nila" ? 63 : 41,
        status: "submitted",
        submittedAt: new Date(Date.now() - 4 * 864e5),
      });
    }

    await db
      .update(s.enrollments)
      .set({ id: enrolment.id })
      .where(eq(s.enrollments.id, enrolment.id));

    logins.push(
      `  ${f.child.padEnd(7)} ${f.username.padEnd(8)} · parent ${f.email.padEnd(22)} · ${f.timezone.padEnd(16)} · unit ${f.unit} · ${f.diligence}`,
    );
  }

  /* --- one family still deciding --------------------------------- */
  await db.insert(s.enquiries).values({
    parentName: "Deepa Nair",
    parentEmail: `deepa${DEMO}`,
    whatsapp: "+971 50 777 7777",
    childFirstName: "Aarav",
    childAgeBand: "8_9",
    childGrade: 3,
    timezone: "Asia/Dubai",
    source: "tool",
    status: "class_scheduled",
    suggestedLevel: 2,
    notes: "Took the check, scored 11/17. Free class booked for Thursday.",
  });

  console.log("\nDemo term seeded.\n");
  console.log("Everyone's password is:", PASSWORD, "\n");
  console.log("  child   username   parent account            timezone           where   practice");
  console.log(logins.join("\n"));
  console.log("\n  teacher  msahajwani@gmail.com  (your existing password)");
  console.log("\nRemove it all again with: npx tsx scripts/seed-demo.ts --reset");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
