/**
 * What a syllabus calls its chunks.
 *
 * The database says `unit` everywhere; each syllabus carries the word its
 * families actually read. Defaults to Week/Weeks because that is what this
 * programme runs, but an intensive course calls them Days and a self-paced one
 * calls them Units, and neither should need a migration.
 *
 * Always render through this rather than writing "Week" into a component —
 * that is the whole point of the column.
 */
export type UnitLabel = { unitLabel: string; unitLabelPlural: string };

export const DEFAULT_UNIT_LABEL: UnitLabel = {
  unitLabel: "Week",
  unitLabelPlural: "Weeks",
};

/** "Week 3" */
export function unitName(label: UnitLabel, position: number): string {
  return `${label.unitLabel} ${position}`;
}

/** "12 weeks" / "1 week" — lower-cased, for running text. */
export function unitCount(label: UnitLabel, n: number): string {
  const word = n === 1 ? label.unitLabel : label.unitLabelPlural;
  return `${n} ${word.toLowerCase()}`;
}

/** The words a teacher can choose between when creating a syllabus. */
export const UNIT_LABEL_CHOICES: { singular: string; plural: string }[] = [
  { singular: "Week", plural: "Weeks" },
  { singular: "Unit", plural: "Units" },
  { singular: "Lesson", plural: "Lessons" },
  { singular: "Part", plural: "Parts" },
  { singular: "Day", plural: "Days" },
];
