/**
 * Human-facing labels and grouping for the content library.
 *
 * The teacher never sees a raw enum value. Labels are plain words — "Slides",
 * not "slides_pdf" — per docs/design-and-copy.md.
 */

/**
 * The shapes an answer can take. Mirrors the `submission_kind` enum.
 *
 * `accepts` below says which of these an activity will take. It is a list,
 * not one value, because a task can fairly be answered more than one way —
 * a child who cannot type yet can photograph the page instead.
 */
export const SUBMISSION_KINDS = {
  text: { label: "Typed", verb: "Write it" },
  audio: { label: "Recording", verb: "Record it" },
  photo: { label: "Photo", verb: "Photograph it" },
  file: { label: "File", verb: "Upload it" },
  answers: { label: "Answers", verb: "Answer it" },
} as const;

export type SubmissionKind = keyof typeof SUBMISSION_KINDS;

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

  /*
   * `accepts` marks the activities that produce something only a person can
   * answer. Everything without it is marked by the app and recorded as a
   * completion instead — a quiz knows whether the child was right, and does
   * not need Sheeba's evening.
   */
  writing_task: {
    label: "Writing task",
    group: "App practice",
    hasFile: false,
    accepts: ["text", "photo"],
  },
  speaking_task: {
    label: "Speaking task",
    group: "App practice",
    hasFile: false,
    accepts: ["audio"],
  },
} as const;

export type ContentTypeKey = keyof typeof CONTENT_TYPES;

/**
 * What a child may hand in for this activity, or an empty list if the app
 * marks it itself. Callers should branch on the length rather than on the
 * type name — the whole point is that the set of submittable types grows.
 */
export function acceptedKinds(type: string): readonly SubmissionKind[] {
  const def = CONTENT_TYPES[type as ContentTypeKey] as
    | { accepts?: readonly SubmissionKind[] }
    | undefined;
  return def?.accepts ?? [];
}

export function needsAPerson(type: string): boolean {
  return acceptedKinds(type).length > 0;
}

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

/** Release rules for a material inside a class. */
export const RELEASE_RULES = {
  before: "Before class",
  during: "During class",
  after: "After class",
  never: "Never — my notes only",
} as const;
