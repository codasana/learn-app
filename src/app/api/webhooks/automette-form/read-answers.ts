/**
 * Turning Automette's `answers` object into our columns.
 *
 * Split out of the route so it can be tested without a signed request, and
 * because the type handling is the fiddly part rather than the HTTP.
 *
 * Automette types answers by field: `number` returns a JSON number **or null
 * when left empty**, `checkbox` returns a boolean, `multi_select` and
 * `file_upload` return arrays, and a skipped field may be absent from the
 * object entirely. So the three states — a value, an explicit null, and
 * missing — all have to collapse to the same thing here, and an empty number
 * must never become 0.
 */

export type ReadAnswers = {
  parentName: string | null;
  parentEmail: string | null;
  whatsapp: string | null;
  childFirstName: string | null;
  childAgeBand: "8_9" | "10_11" | null;
  childGrade: number | null;
  timezone: string;
  message: string | null;
};

/** A string answer, or null. Numbers are stringified; nothing else is. */
function str(answers: Record<string, unknown>, key: string): string | null {
  const v = answers[key];
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  // null, undefined, booleans and arrays are not text.
  return null;
}

/** A whole number, or null. An empty number field is null, never 0. */
function num(answers: Record<string, unknown>, key: string): number | null {
  const v = answers[key];
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Math.trunc(Number(v));
  }
  return null;
}

export function readAnswers(answers: Record<string, unknown>): ReadAnswers {
  const band = str(answers, "child_age_band");

  return {
    parentName: str(answers, "parent_name"),
    parentEmail: str(answers, "parent_email")?.toLowerCase() ?? null,
    whatsapp: str(answers, "whatsapp"),
    childFirstName: str(answers, "child_first_name"),
    childAgeBand: band === "8_9" || band === "10_11" ? band : null,
    childGrade: num(answers, "child_grade"),
    // Only used to render times to this family; a missing one is not worth
    // rejecting an enquiry over.
    timezone: str(answers, "timezone") ?? "Asia/Kolkata",
    message: str(answers, "message"),
  };
}
