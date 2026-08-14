/**
 * The free tools on the website.
 *
 * Adding a tool means: a value in the `tool_kind` enum, a file next to this
 * one, and an entry below. Never a new table — everything a tool records goes
 * into `tool_runs.responses` and `tool_runs.result`, shaped by its own zod
 * schemas.
 *
 * The hard rule, worth repeating because it is the reason this directory
 * exists at all: **a tool may not read from or write to the programme.** No
 * content items, no syllabi, no enrollments, no child progress. The tools are
 * marketing and will churn; the programme is the thing being sold.
 */

import * as levelCheck from "./level-check";

export type ToolKey = "level_check";

export const TOOLS = {
  level_check: {
    key: "level_check" as const,
    /** What a parent sees on the website. */
    title: "Check your child's English level",
    /** One plain sentence. No superlatives. */
    blurb:
      "A short set of questions — words, reading and listening. It takes about twelve minutes and you don't need an account.",
    minutes: levelCheck.LEVEL_CHECK_MINUTES,
    /** Where the tool starts. */
    href: "/check",
  },
} as const;

export const TOOL_KEYS = Object.keys(TOOLS) as ToolKey[];

export function toolTitle(key: string): string {
  return TOOLS[key as ToolKey]?.title ?? key;
}

export { levelCheck };
