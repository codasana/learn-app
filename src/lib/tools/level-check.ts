/**
 * "Check your child's English level" — the free tool on the website.
 *
 * Everything is here: the questions, the scoring, and what a child is told.
 * Nothing is read from the content library and nothing is written back to the
 * programme. This file can be rewritten or deleted without a migration and
 * without touching a single thing a paying child is learning from.
 *
 * The questions are marketing copy, not curriculum. They live in code because
 * they change rarely and because a content editor for them would be a tool
 * nobody asked for.
 */

import { z } from "zod";

export const LEVEL_CHECK_MINUTES = 12;

export type Section = "vocabulary" | "reading" | "listening";

export type Question = {
  id: string;
  section: Section;
  prompt: string;
  options: string[];
  correctIndex: number;
};

/** Read to the child before the listening questions. Recorded later. */
export const LISTENING_SCRIPT = `Hello! My name is Dev. I am eight years old and I live in Bengaluru.
I go to school every day. My school has a big playground.
In the evening I play football with my friend Imran.
I have a cat called Mishti. She is white and very soft.`;

export const READING_PASSAGE = {
  title: "The Lost Kite",
  paragraphs: [
    "It was a windy Sunday. Nila took her new red kite to the open ground near her house. Her brother Ravi came with her.",
    "The kite went up and up. Nila laughed. Then the string broke and the kite flew away over the trees.",
    "Nila was sad. But Ravi said, \"Look!\" The kite had landed on a low branch. They pulled it down carefully. Only one corner was torn.",
    "That evening their grandmother mended the kite with a piece of cloth. Nila said it looked even better than before.",
  ],
};

/**
 * Ordered easy → hard within each section, so a child who is out of their
 * depth still answers something and leaves feeling they had a go. The result
 * is a rough picture, not a diagnosis — the real read happens in the class.
 */
export const QUESTIONS: Question[] = [
  // --- vocabulary ---------------------------------------------------
  {
    id: "v1",
    section: "vocabulary",
    prompt: "Which word means the opposite of “big”?",
    options: ["tall", "small", "wide"],
    correctIndex: 1,
  },
  {
    id: "v2",
    section: "vocabulary",
    prompt: "A person who teaches you at school is a ___.",
    options: ["doctor", "driver", "teacher"],
    correctIndex: 2,
  },
  {
    id: "v3",
    section: "vocabulary",
    prompt: "She was very ___ when she won the race.",
    options: ["happy", "empty", "quiet"],
    correctIndex: 0,
  },
  {
    id: "v4",
    section: "vocabulary",
    prompt: "Which one is a vegetable?",
    options: ["mango", "carrot", "biscuit"],
    correctIndex: 1,
  },
  {
    id: "v5",
    section: "vocabulary",
    prompt: "“The room was silent.” Silent means ___.",
    options: ["very bright", "very noisy", "very quiet"],
    correctIndex: 2,
  },
  {
    id: "v6",
    section: "vocabulary",
    prompt: "He was nervous before the exam. Nervous means ___.",
    options: ["a little worried", "very hungry", "very fast"],
    correctIndex: 0,
  },

  // --- grammar, counted with vocabulary -----------------------------
  {
    id: "v7",
    section: "vocabulary",
    prompt: "I ___ nine years old.",
    options: ["is", "am", "are"],
    correctIndex: 1,
  },
  {
    id: "v8",
    section: "vocabulary",
    prompt: "Yesterday we ___ to the park.",
    options: ["go", "goes", "went"],
    correctIndex: 2,
  },

  // --- reading ------------------------------------------------------
  {
    id: "r1",
    section: "reading",
    prompt: "What colour was Nila's kite?",
    options: ["red", "blue", "green"],
    correctIndex: 0,
  },
  {
    id: "r2",
    section: "reading",
    prompt: "Who went with Nila to the ground?",
    options: ["her mother", "her brother", "her friend"],
    correctIndex: 1,
  },
  {
    id: "r3",
    section: "reading",
    prompt: "Why did the kite fly away?",
    options: [
      "Nila let it go",
      "the string broke",
      "Ravi threw it",
    ],
    correctIndex: 1,
  },
  {
    id: "r4",
    section: "reading",
    prompt: "Where did they find the kite?",
    options: ["in the river", "on a low branch", "on the roof"],
    correctIndex: 1,
  },
  {
    id: "r5",
    section: "reading",
    prompt: "How did Nila feel at the end of the story?",
    options: ["still sad", "angry with Ravi", "pleased"],
    correctIndex: 2,
  },

  // --- listening ----------------------------------------------------
  {
    id: "l1",
    section: "listening",
    prompt: "What is the boy's name?",
    options: ["Dev", "Deep", "Dan"],
    correctIndex: 0,
  },
  {
    id: "l2",
    section: "listening",
    prompt: "Where does he live?",
    options: ["Bengaluru", "Baroda", "Bhopal"],
    correctIndex: 0,
  },
  {
    id: "l3",
    section: "listening",
    prompt: "What does he play in the evening?",
    options: ["cricket", "football", "chess"],
    correctIndex: 1,
  },
  {
    id: "l4",
    section: "listening",
    prompt: "Who is Mishti?",
    options: ["his sister", "his cat", "his friend"],
    correctIndex: 1,
  },
];

export const SECTIONS: Section[] = ["vocabulary", "reading", "listening"];

export const SECTION_LABELS: Record<Section, string> = {
  vocabulary: "Words and grammar",
  reading: "Reading",
  listening: "Listening",
};

/* ------------------------------------------------------------------ */
/* What gets stored                                                    */
/* ------------------------------------------------------------------ */

/** answers: question id → chosen option index. */
export const responsesSchema = z.object({
  answers: z.record(z.string(), z.number().int().min(0)).default({}),
});
export type Responses = z.infer<typeof responsesSchema>;

export const resultSchema = z.object({
  total: z.number().int(),
  outOf: z.number().int(),
  sections: z.record(
    z.string(),
    z.object({ score: z.number().int(), outOf: z.number().int() }),
  ),
  strongest: z.string(),
  suggestedLevel: z.number().int().min(1).max(4),
});
export type Result = z.infer<typeof resultSchema>;

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export function score(responses: Responses): Result {
  const sections: Result["sections"] = {};
  for (const s of SECTIONS) sections[s] = { score: 0, outOf: 0 };

  let total = 0;
  for (const q of QUESTIONS) {
    sections[q.section].outOf += 1;
    if (responses.answers[q.id] === q.correctIndex) {
      sections[q.section].score += 1;
      total += 1;
    }
  }

  // Ties go to the earlier section, which is the more foundational one — no
  // sense telling a parent their child's listening is the strong suit when
  // vocabulary scored the same.
  const strongest = SECTIONS.reduce((best, s) =>
    sections[s].score / sections[s].outOf >
    sections[best].score / sections[best].outOf
      ? s
      : best,
  );

  return {
    total,
    outOf: QUESTIONS.length,
    sections,
    strongest,
    suggestedLevel: suggestLevel(total / QUESTIONS.length),
  };
}

/**
 * Deliberately blunt, and deliberately cautious at the boundaries.
 *
 * This number is a conversation-starter for the demo class, never a verdict —
 * the teacher decides, and when in doubt she places lower, because early
 * confidence beats early struggle. Nothing in the programme reads this value.
 */
function suggestLevel(fraction: number): number {
  if (fraction >= 0.85) return 4;
  if (fraction >= 0.65) return 3;
  if (fraction >= 0.4) return 2;
  return 1;
}

/**
 * The whole result, shown the moment they finish, to anyone, for nothing.
 *
 * This used to be a deliberate half — a total and a superlative — with the
 * rest held back behind an email. That gate is gone, and it should not come
 * back, for a reason worth writing down: everything here is arithmetic over
 * seventeen multiple-choice answers. There is no judgement in it, because
 * nobody has met the child yet. Charging an email for arithmetic is what
 * forced us to call it a "full report" — a thing that then had to either
 * disappoint on arrival or turn up days later as something else entirely.
 *
 * So this is free, and the ask moves to what genuinely needs an address: a
 * session with Sheeba, which is where the judgement actually happens.
 *
 * `suggestedLevel` stays OUT. It is the one figure here that reads as a
 * verdict, and a verdict is exactly what seventeen taps cannot support. It
 * goes to Sheeba instead, as an opening for a conversation.
 */
export function partialResult(result: Result) {
  return {
    total: result.total,
    outOf: result.outOf,
    strongest: SECTION_LABELS[result.strongest as Section],
    sections: SECTIONS.map((s) => ({
      key: s,
      label: SECTION_LABELS[s],
      score: result.sections[s]?.score ?? 0,
      outOf: result.sections[s]?.outOf ?? 0,
    })),
  };
}

export type PartialResult = ReturnType<typeof partialResult>;
