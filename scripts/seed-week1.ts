/**
 * Seeds Week 1 of Level 1 — "All About Me" — from V2/03-Level1-Content-Pack.
 *
 *   npx tsx scripts/seed-week1.ts
 *   npx tsx scripts/seed-week1.ts --reset    (removes it and starts over)
 *
 * This is a worked example, not fixed content. Everything it creates is
 * editable and deletable in the app exactly as if it had been typed there —
 * the point is that Sheeba opens week 1 and sees a finished week to copy the
 * shape of, rather than an empty form.
 *
 * The three PDFs (slides, two worksheets) land as drafts with no file
 * attached, because file upload is not connected yet. They are the honest
 * placeholder: the week is complete apart from the things that genuinely are
 * not ready.
 */
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";

config({ path: ".env.local" });

const SYLLABUS_NAME = "Level 1 · Foundations";
const WEEKS = 12;

/* ------------------------------------------------------------------ */
/* The content, transcribed from the pack                              */
/* ------------------------------------------------------------------ */

const VOCAB: [word: string, meaning: string, example: string][] = [
  ["name", "what people call you", "My name is Aarav."],
  ["age", "how old you are", "What is your age?"],
  ["school", "the place where you learn", "My school is big."],
  ["class", "your group at school", "I am in class three."],
  ["friend", "a person you like to play with", "Sara is my best friend."],
  ["family", "the people you live with and love", "I love my family."],
  ["house", "the place where you live", "Our house has a red door."],
  ["city", "a big place with many houses and roads", "Mumbai is a big city."],
  ["like", "to enjoy something", "I like mangoes."],
  ["love", "to like something very, very much", "I love my dog."],
  ["play", "to have fun with games or toys", "We play in the park."],
  ["read", "to look at words and understand them", "I read a book every night."],
  ["happy", "feeling good and smiling", "She is happy today."],
  ["tall", "big in height", "My father is tall."],
  ["short", "small in height", "The puppy is short."],
  ["hair", "what grows on your head", "Riya has long hair."],
  ["eyes", "you see with these", "He has brown eyes."],
  ["smile", "a happy face", "Your smile is nice."],
];

const MEERA = [
  "My name is Meera. I am eight years old. I live in Pune with my family. I am in class three. My school is big and clean.",
  "I have two good friends. Their names are Sara and Rohan. We play together every day after school.",
  "I like to read storybooks. I love animals. I have a small dog. His name is Bruno. He has brown eyes and soft hair.",
  "When I come home from school, Bruno runs to me. I am happy when I play with him.",
];

const ARJUN = [
  "Arjun is nine years old. He lives in a tall building in Chennai. He is in class four.",
  "Arjun has a blue bicycle. He rides it every evening. His friend Kabir rides with him. They go round and round the park.",
  "Arjun likes his bicycle very much. It was a birthday gift from his grandmother. He keeps it clean and shiny.",
];

const ARJUN_Q = [
  ["How old is Arjun?", ["8", "9", "10"], 1],
  ["What colour is his bicycle?", ["red", "blue", "green"], 1],
  ["Who rides with Arjun?", ["Kabir", "his sister", "his grandmother"], 0],
  [
    "Who gave Arjun the bicycle?",
    ["his father", "his teacher", "his grandmother"],
    2,
  ],
  [
    "Arjun keeps his bicycle…",
    ["dirty", "clean and shiny", "at school"],
    1,
  ],
] as const;

const ZARA = [
  "Zara is eight years old. She lives in Dubai with her mother, father, and baby brother.",
  'Zara goes to a new school this year. At first she was shy. Then a girl said, "Hello! My name is Fatima. Come and play with us."',
  "Now Zara has many friends. She likes her new school. Every day she comes home with a big smile.",
];

const ZARA_Q = [
  ["Where does Zara live?", ["Dubai", "Delhi", "Doha"], 0],
  [
    "Who is in Zara's family?",
    [
      "only her mother",
      "mother, father and baby brother",
      "her grandmother",
    ],
    1,
  ],
  ["How did Zara feel at first?", ["shy", "angry", "sleepy"], 0],
  ["Who said hello to Zara?", ["her teacher", "Fatima", "her brother"], 1],
  [
    "How does Zara come home now?",
    ["with a big smile", "with a book", "very tired"],
    0,
  ],
] as const;

const LISTENING_SCRIPT = [
  "Hello! My name is Dev. I am eight years old. I live in Bengaluru.",
  "I am in class three. My school has a big playground.",
  "I have one friend in my building. His name is Imran. We play football in the evening.",
  "I have a cat. Her name is Mishti. She is white and very soft. I love my cat.",
].join("\n");

const LISTENING_Q = [
  ["What is the boy's name?", ["Dev", "Deep", "Dan"], 0],
  ["Where does he live?", ["Bengaluru", "Baroda", "Bhopal"], 0],
  ["What do Dev and Imran play?", ["cricket", "football", "chess"], 1],
  ["Who is Mishti?", ["his sister", "his cat", "his teacher"], 1],
] as const;

const SENTENCES: [tiles: string[], correct: string][] = [
  [["is", "My", "Meera", "name"], "My name is Meera."],
  [["am", "I", "years", "eight", "old"], "I am eight years old."],
  [["a", "have", "I", "dog", "small"], "I have a small dog."],
  [["school", "My", "big", "is"], "My school is big."],
  [["to", "like", "I", "read"], "I like to read."],
  [["friend", "is", "Sara", "my"], "Sara is my friend."],
];

const QUIZ = [
  [
    'Which word means "a person you like to play with"?',
    ["family", "friend", "school"],
    1,
  ],
  ["I ___ eight years old.", ["is", "am", "are"], 1],
  [
    "Pick the correct sentence.",
    ["my name is ravi", "My name is Ravi.", "My Name Is Ravi"],
    1,
  ],
  ["Meera lives in ___.", ["Pune", "Dubai", "Chennai"], 0],
  ['The opposite of "tall" is ___.', ["big", "short", "small"], 1],
  ["She has brown ___.", ["eyes", "smile", "city"], 0],
  ["I ___ my family very much.", ["love", "play", "read"], 0],
  ["Zara lives in ___.", ["Dubai", "Pune", "Bengaluru"], 0],
] as const;

const CLASS_1_PLAN = `**Warm-up (5 min).** "Tell me your name, your age, and one thing you like." Model it first yourself.

**App setup (5 min).** Open the app together, show the Today screen, do 3 vocabulary cards as a demo.

**Main teaching (15 min).** Read *Meet Meera* together — you read once, the child reads once. Underline *name, age, school, friend*. Point out: capital letter starts, full stop ends.

**Guided practice (13 min).** Comprehension questions aloud. Insist on full sentences — "She is eight years old", not "eight".

1. How old is Meera? *(She is eight years old.)*
2. Where does Meera live? *(Pune.)*
3. Who are Meera's friends? *(Sara and Rohan.)*
4. What does Meera like to do? *(Read storybooks / play with Bruno.)*
5. What colour are Bruno's eyes? *(Brown.)*
6. Thinking question: why is Meera happy at the end? *(Any sensible answer.)*

**Speaking finish (5 min).** "Be Meera!" — the child pretends to be Meera and introduces herself, then introduces themselves the same way.

**Set app work (2 min).** Vocabulary cards daily; passage A and the listening clip before the next class.`;

const CLASS_2_PLAN = `**Warm-up (5 min).** "Tell me about a friend." Two or three sentences.

**App review (5 min).** Word Practice together; replay the tricky words; check the passage A answers.

**Main teaching (15 min).** Plan the writing task aloud using the three planning boxes. Write the child's spoken sentences on screen, then have them read them back.

**Guided practice (13 min).** The child writes their 3 sentences while you watch. Fix capitals and full stops in the moment.

**Speaking finish (5 min).** "Three things about me" — the child says three, you say three, spot anything you have in common.

**Set app work (2 min).** Submit the writing task, do passage B, take the weekly quiz.`;

/* ------------------------------------------------------------------ */

const q = (prompt: string, options: readonly string[], correctIndex: number) => ({
  prompt,
  options: [...options],
  correctIndex,
});

async function main() {
  const reset = process.argv.includes("--reset");

  const { db } = await import("../src/db");
  const {
    classSessionMaterials,
    classSessions,
    contentItems,
    syllabi,
    syllabusWeeks,
    syllabusWeekItems,
    users,
  } = await import("../src/db/schema");

  const owner = await db.query.users.findFirst({
    where: eq(users.email, "msahajwani@gmail.com"),
  });
  if (!owner) {
    console.error(
      "No owner account found. Run scripts/seed-owner.ts first.",
    );
    process.exit(1);
  }

  const existing = await db.query.syllabi.findFirst({
    where: eq(syllabi.name, SYLLABUS_NAME),
  });

  if (existing && !reset) {
    console.log(
      `"${SYLLABUS_NAME}" already exists. Re-run with --reset to rebuild it.`,
    );
    process.exit(0);
  }

  if (existing) {
    // Week items and materials cascade from the syllabus; the content items
    // they point at do not, so those go by title.
    await db.delete(syllabi).where(eq(syllabi.id, existing.id));
    console.log("removed the previous seeded syllabus");
  }

  /* --- content items ------------------------------------------------ */

  const make = async (
    values: Omit<typeof contentItems.$inferInsert, "createdBy">,
  ) => {
    // Titles are the identity here so a --reset does not leave orphans behind.
    // Deliberately not scoped by author: an earlier test run may have left a
    // row with no author at all, and a library with two "Meet Meera"s in it is
    // worse than useless.
    await db.delete(contentItems).where(eq(contentItems.title, values.title));
    const [row] = await db
      .insert(contentItems)
      .values({ ...values, createdBy: owner.id })
      .returning({ id: contentItems.id });
    return row.id;
  };

  const base = {
    difficultyLevel: 1,
    ageBand: "any" as const,
    audience: "student" as const,
    status: "published" as const,
    themeTags: ["all about me", "introductions"],
    grammarTags: ["i am", "i have", "i like"],
  };

  const vocabId = await make({
    ...base,
    title: "Week 1 words — All About Me",
    type: "vocab_set",
    body: {
      words: VOCAB.map(([word, meaning, exampleSentence]) => ({
        word,
        meaning,
        exampleSentence,
        imageUrl: null,
        audioUrl: null,
        // Left empty on purpose: review draws its wrong answers from the other
        // words in the set, so distractors stay right as the set is edited.
        distractorMeanings: [],
      })),
    },
  });

  const meeraId = await make({
    ...base,
    title: "Meet Meera",
    type: "passage",
    // The comprehension questions are asked aloud in class, so they live in
    // the class plan rather than here — the child reads this one cold.
    body: { paragraphs: MEERA, questions: [] },
  });

  const slidesId = await make({
    ...base,
    title: "What makes a sentence",
    type: "slides",
    status: "draft",
    body: {
      caption: "Capital letter at the start, full stop at the end.",
      notes: "The PDF still needs attaching — file upload is not connected yet.",
    },
  });

  const roleplayId = await make({
    ...base,
    title: "“Be Meera!” role-play",
    type: "activity",
    audience: "teacher",
    body: {
      instructions:
        "The child becomes Meera and introduces herself in the first person — name, age, city, class, friends, dog. Then they introduce themselves the same way, same order. Prompt with the passage only if they stall; do not correct grammar mid-flow, note it and come back.",
    },
  });

  const plannerId = await make({
    ...base,
    title: "Writing planner: three boxes",
    type: "worksheet",
    status: "draft",
    body: {
      caption: "My name and age · My school or city · One thing I like",
      notes: "The PDF still needs attaching — file upload is not connected yet.",
    },
  });

  const threeThingsId = await make({
    ...base,
    title: "“Three things about me” game",
    type: "activity",
    audience: "teacher",
    body: {
      instructions:
        "The child says three things about themselves, then you say three about yourself. Find anything you have in common and make something of it. Keeps the class ending on speaking, not marking.",
    },
  });

  const capitalsId = await make({
    ...base,
    title: "Capitals and full stops practice",
    type: "worksheet",
    status: "draft",
    body: {
      caption: "Sentences to fix — capitals at the start, full stops at the end.",
      notes: "The PDF still needs attaching — file upload is not connected yet.",
    },
  });

  const arjunId = await make({
    ...base,
    title: "Arjun and His Bicycle",
    type: "passage",
    body: {
      paragraphs: ARJUN,
      questions: ARJUN_Q.map(([p, o, c]) => q(p, o, c)),
    },
  });

  const zaraId = await make({
    ...base,
    title: "Zara's New School",
    type: "passage",
    body: {
      paragraphs: ZARA,
      questions: ZARA_Q.map(([p, o, c]) => q(p, o, c)),
    },
  });

  const listeningId = await make({
    ...base,
    title: "Dev introduces himself",
    type: "listening",
    status: "draft",
    body: {
      transcript: LISTENING_SCRIPT,
      audioUrl: null,
      questions: LISTENING_Q.map(([p, o, c]) => q(p, o, c)),
    },
  });

  const builderId = await make({
    ...base,
    title: "Week 1 sentence builder",
    type: "sentence_builder",
    body: {
      items: SENTENCES.map(([tiles, correctSentence]) => ({
        tiles,
        correctSentence,
      })),
    },
  });

  const writingId = await make({
    ...base,
    title: "Three sentences about yourself",
    type: "writing_task",
    body: {
      prompt:
        "Write 3 sentences about yourself. Remember: every sentence starts with a capital letter and ends with a full stop.",
      planningBoxes: [
        "My name and age",
        "My school or city",
        "One thing I like",
      ],
      modelAnswer:
        "My name is Anaya. I am eight years old and I live in Pune. I like to draw pictures of birds.",
      feedbackFocus:
        "Capital letters and full stops only. Ignore spelling unless it blocks the meaning — confidence first.",
    },
  });

  const quizId = await make({
    ...base,
    title: "Week 1 quiz — All About Me",
    type: "quiz",
    body: { questions: QUIZ.map(([p, o, c]) => q(p, o, c)) },
  });

  /* --- the syllabus ------------------------------------------------- */

  const [syllabus] = await db
    .insert(syllabi)
    .values({ name: SYLLABUS_NAME, level: 1, createdBy: owner.id })
    .returning({ id: syllabi.id });

  await db.insert(syllabusWeeks).values(
    Array.from({ length: WEEKS }, (_, i) => ({
      syllabusId: syllabus.id,
      weekNumber: i + 1,
      theme: i === 0 ? "All About Me" : "",
      grammarFocus: i === 0 ? "I am / I have / I like" : null,
    })),
  );

  const week1 = await db.query.syllabusWeeks.findFirst({
    where: and(
      eq(syllabusWeeks.syllabusId, syllabus.id),
      eq(syllabusWeeks.weekNumber, 1),
    ),
  });
  if (!week1) throw new Error("week 1 vanished");

  const [class1, class2] = await db
    .insert(classSessions)
    .values([
      {
        syllabusWeekId: week1.id,
        classNumber: 1,
        title: "Meet Meera",
        planMd: CLASS_1_PLAN,
      },
      {
        syllabusWeekId: week1.id,
        classNumber: 2,
        title: "My turn to talk",
        planMd: CLASS_2_PLAN,
      },
    ])
    .returning({ id: classSessions.id });

  await db.insert(classSessionMaterials).values([
    {
      classSessionId: class1.id,
      contentItemId: meeraId,
      sortOrder: 0,
      release: "before" as const,
    },
    {
      classSessionId: class1.id,
      contentItemId: slidesId,
      sortOrder: 1,
      release: "during" as const,
    },
    {
      classSessionId: class1.id,
      contentItemId: roleplayId,
      sortOrder: 2,
      release: "never" as const,
    },
    {
      classSessionId: class2.id,
      contentItemId: plannerId,
      sortOrder: 0,
      release: "during" as const,
    },
    {
      classSessionId: class2.id,
      contentItemId: threeThingsId,
      sortOrder: 1,
      release: "never" as const,
    },
    {
      classSessionId: class2.id,
      contentItemId: capitalsId,
      sortOrder: 2,
      release: "after" as const,
    },
  ]);

  // The order the child meets them in between the two classes.
  await db.insert(syllabusWeekItems).values(
    [vocabId, arjunId, listeningId, builderId, writingId, zaraId, quizId].map(
      (contentItemId, sortOrder) => ({
        syllabusWeekId: week1.id,
        contentItemId,
        sortOrder,
      }),
    ),
  );

  console.log(`
Seeded "${SYLLABUS_NAME}"

  13 content items — 3 of them drafts, waiting on their PDFs
  12 weeks, week 1 filled in
  Class 1 and Class 2, 3 materials each
  7 things for the child to do on their own

  /teacher/syllabus/${syllabus.id}
`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
