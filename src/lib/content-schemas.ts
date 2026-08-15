import { z } from "zod";

/**
 * The shape of each content type's `body`.
 *
 * These are the contract between the teacher's form and everything that later
 * renders the content to a child. Keep them permissive on save — a half-written
 * draft must always be savable — and rely on the publish check for rigour.
 */

export const questionSchema = z.object({
  prompt: z.string().default(""),
  options: z.array(z.string()).default([]),
  correctIndex: z.number().int().min(0).default(0),
});
export type Question = z.infer<typeof questionSchema>;

export const passageBody = z.object({
  paragraphs: z.array(z.string()).default([]),
  questions: z.array(questionSchema).default([]),
});

export const vocabWordSchema = z.object({
  word: z.string().default(""),
  meaning: z.string().default(""),
  exampleSentence: z.string().default(""),
  /** Only concrete nouns get a picture; most Level 1 words have none. */
  imageUrl: z.string().nullable().default(null),
  audioUrl: z.string().nullable().default(null),
  /** Wrong meanings shown alongside the right one in review. */
  distractorMeanings: z.array(z.string()).default([]),
});
export type VocabWord = z.infer<typeof vocabWordSchema>;

export const vocabSetBody = z.object({
  words: z.array(vocabWordSchema).default([]),
});

export const listeningBody = z.object({
  transcript: z.string().default(""),
  audioUrl: z.string().nullable().default(null),
  questions: z.array(questionSchema).default([]),
});

export const sentenceBuilderItem = z.object({
  correctSentence: z.string().default(""),
  /** Shuffled client-side; stored in reading order. */
  tiles: z.array(z.string()).default([]),
});

export const sentenceBuilderBody = z.object({
  items: z.array(sentenceBuilderItem).default([]),
});

export const quizBody = z.object({
  questions: z.array(questionSchema).default([]),
});

export const writingTaskBody = z.object({
  prompt: z.string().default(""),
  planningBoxes: z.array(z.string()).default(["", "", ""]),
  modelAnswer: z.string().default(""),
  /** What to mark this week, e.g. "capital letters and full stops only". */
  feedbackFocus: z.string().default(""),
});

/**
 * A task the child answers out loud.
 *
 * Deliberately close to writingTaskBody rather than merged with it: the
 * prompts are the same idea, but what Sheeba listens for is not what she
 * reads for, and `maxSeconds` has no writing equivalent. Two small schemas
 * beat one with half its fields ignored.
 */
export const speakingTaskBody = z.object({
  prompt: z.string().default(""),
  /** Bullets the child can glance at while speaking. */
  planningBoxes: z.array(z.string()).default(["", "", ""]),
  /** A cap, so a nervous child is not staring at an open-ended recorder. */
  maxSeconds: z.number().int().min(15).max(600).default(90),
  feedbackFocus: z.string().default(""),
});

/**
 * The part of any task that the review screen needs: what the child was asked,
 * and what to mark. Every submittable task type has both, so this parses all
 * of them without knowing which it is holding.
 */
export const reviewPrompt = z.object({
  prompt: z.string().default(""),
  feedbackFocus: z.string().default(""),
});

export const activityBody = z.object({
  instructions: z.string().default(""),
});

export const fileBody = z.object({
  caption: z.string().default(""),
  notes: z.string().default(""),
});

export const BODY_SCHEMAS = {
  passage: passageBody,
  vocab_set: vocabSetBody,
  listening: listeningBody,
  sentence_builder: sentenceBuilderBody,
  quiz: quizBody,
  writing_task: writingTaskBody,
  speaking_task: speakingTaskBody,
  activity: activityBody,
  slides: fileBody,
  worksheet: fileBody,
  image: fileBody,
  audio: fileBody,
  video: fileBody,
} as const;

export type BodyForType<T extends keyof typeof BODY_SCHEMAS> = z.infer<
  (typeof BODY_SCHEMAS)[T]
>;

/** Parses stored JSON into a shape the form can render, filling any gaps. */
export function parseBody(type: string, raw: unknown) {
  const schema = BODY_SCHEMAS[type as keyof typeof BODY_SCHEMAS];
  if (!schema) return {};
  const result = schema.safeParse(raw ?? {});
  return result.success ? result.data : schema.parse({});
}

/**
 * Checks completeness at publish time only. Drafts save regardless — being
 * unable to save half-finished work is how people stop using a tool.
 */
export function readyToPublish(type: string, body: unknown): string | null {
  const b = parseBody(type, body) as Record<string, unknown>;

  switch (type) {
    case "passage": {
      const paras = (b.paragraphs as string[]) ?? [];
      if (paras.filter((p) => p.trim()).length === 0)
        return "Add at least one paragraph before publishing.";
      return null;
    }
    case "vocab_set": {
      const words = (b.words as VocabWord[]) ?? [];
      const filled = words.filter((w) => w.word.trim() && w.meaning.trim());
      if (filled.length === 0)
        return "Add at least one word with a meaning before publishing.";
      return null;
    }
    case "quiz": {
      const qs = (b.questions as Question[]) ?? [];
      if (qs.filter((q) => q.prompt.trim()).length === 0)
        return "Add at least one question before publishing.";
      return null;
    }
    case "writing_task": {
      if (!String(b.prompt ?? "").trim())
        return "Add the prompt before publishing.";
      return null;
    }
    case "sentence_builder": {
      const items = (b.items as { correctSentence: string }[]) ?? [];
      if (items.filter((i) => i.correctSentence.trim()).length === 0)
        return "Add at least one sentence before publishing.";
      return null;
    }
    default:
      return null;
  }
}
