/**
 * Human-facing labels and grouping for the content library.
 *
 * The teacher never sees a raw enum value. Labels are plain words — "Slides",
 * not "slides_pdf" — per docs/design-and-copy.md.
 */

export const CONTENT_TYPES = {
  // Materials used in a live class
  passage: { label: "Passage", group: "Class material", hasFile: false },
  slides: { label: "Slides", group: "Class material", hasFile: true },
  worksheet: { label: "Worksheet", group: "Class material", hasFile: true },
  image: { label: "Image", group: "Class material", hasFile: true },
  audio: { label: "Audio", group: "Class material", hasFile: true },
  video: { label: "Video", group: "Class material", hasFile: true },
  activity: { label: "Activity", group: "Class material", hasFile: false },

  // Items the child does alone, in the app
  vocab_set: { label: "Word list", group: "App practice", hasFile: false },
  listening: { label: "Listening clip", group: "App practice", hasFile: true },
  sentence_builder: {
    label: "Sentence builder",
    group: "App practice",
    hasFile: false,
  },
  quiz: { label: "Quiz", group: "App practice", hasFile: false },
  writing_task: { label: "Writing task", group: "App practice", hasFile: false },
} as const;

export type ContentTypeKey = keyof typeof CONTENT_TYPES;

export const CONTENT_TYPE_KEYS = Object.keys(CONTENT_TYPES) as ContentTypeKey[];

export const CONTENT_GROUPS = ["Class material", "App practice"] as const;

export function contentTypesInGroup(group: (typeof CONTENT_GROUPS)[number]) {
  return CONTENT_TYPE_KEYS.filter((k) => CONTENT_TYPES[k].group === group);
}

export const AGE_BANDS = {
  any: "Any age",
  "8_9": "8–9 years",
  "10_11": "10–11 years",
} as const;

export const AUDIENCES = {
  student: "Student",
  teacher: "Teacher only",
  parent: "Parent",
} as const;

export const LEVELS = [1, 2, 3, 4] as const;

export const LEVEL_NAMES: Record<number, string> = {
  1: "Level 1 · Foundations",
  2: "Level 2 · Builders",
  3: "Level 3 · Explorers",
  4: "Level 4 · Communicators",
};

/** Release rules for a material inside a class. */
export const RELEASE_RULES = {
  before: "Before class",
  during: "During class",
  after: "After class",
  never: "Never — my notes only",
} as const;
