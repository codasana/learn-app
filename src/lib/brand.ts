/**
 * The product name lives here and nowhere else.
 *
 * "English Ladder" is a PLACEHOLDER. Renaming must be a single edit to this
 * file — so never hardcode the name in a component, a page, a document
 * template, or an email. Import from here instead.
 *
 * Equally: no design or copy may lean on a ladder metaphor — no rungs, no
 * climbing, no steps, no "next rung" language. The metaphor dies with the name.
 */

export const brand = {
  /** Display name. Placeholder — see above. */
  name: "English Ladder",

  /** Used in page titles: "Today · English Ladder" */
  titleSuffix: "English Ladder",

  /** One plain sentence. No superlatives, no marketing adjectives. */
  tagline: "Live English classes for children, with daily practice in between.",

  /** Legal entity, for footers and generated documents. */
  legalEntity: "Learn Kraft Info Solutions LLP",
  legalCity: "Bengaluru, India",

  /** Filled in when the domain is settled. */
  domain: "",
  supportWhatsapp: "",
  supportEmail: "",
} as const;

export function pageTitle(section?: string) {
  return section ? `${section} · ${brand.titleSuffix}` : brand.titleSuffix;
}

/**
 * What we call people, in user-facing copy only.
 *
 * The database, the route group and the `role` enum stay on "teacher" — those
 * are internal names, understood by every developer and by Better Auth, and
 * renaming them buys nothing. What a parent reads is a separate decision, and
 * it lives here so it can change in one edit on any day.
 *
 * Same rule as the brand name: never hardcode these words in a component,
 * an email, or a document template.
 */
export const people = {
  /** Sheeba, and anyone hired later. */
  teacher: "teacher",
  teachers: "teachers",
  Teacher: "Teacher",
  Teachers: "Teachers",

  /** The learner. "Student" in copy to parents, "you" in copy to the child. */
  student: "student",
  students: "students",

  /** The paying account holder. */
  parent: "parent",
  parents: "parents",
} as const;

/**
 * Whether the teacher is named in public, and what she is called if not.
 *
 * She still holds a job elsewhere. A first name is not much on its own — but
 * a first name beside "teaches English", a city and a business is enough to
 * connect her to this, and a search engine does that joining for free and
 * then keeps the result for years. The exposure is the pairing, not the name.
 *
 * So the name is configuration, exactly like the product name above: leave it
 * null and every public sentence says "your teacher" instead. One edit, in
 * either direction, on whichever day she decides — including the day she
 * hands in her notice.
 *
 * A pseudonym was the obvious third option and it is a trap. She is on video
 * within thirty seconds of every session starting; a name that does not match
 * the person is a small lie a parent catches at once, and catching it costs
 * more trust than the name was ever worth.
 *
 * What this does NOT cover, deliberately: code comments and commit messages,
 * which are private and describe real decisions about a real person; and
 * anything she signs herself writing to a family. Those are hers.
 */
export const teacher = {
  /** Her name in public copy, or null to stay unnamed. */
  publicName: null as string | null,
};

/** "Sheeba", or "your teacher". For mid-sentence. */
export function teacherName(): string {
  return teacher.publicName ?? `your ${people.teacher}`;
}

/** "Sheeba", or "Your teacher". For the start of a sentence. */
export function TeacherName(): string {
  const n = teacherName();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** "Sheeba's", or "your teacher's". */
export function teacherPossessive(): string {
  const n = teacherName();
  return n.endsWith("s") ? `${n}'` : `${n}'s`;
}
