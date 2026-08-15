/**
 * The four kinds of account.
 *
 * "student" was missing here for a while even though child accounts have
 * carried that role since they were introduced — which made requireRole treat
 * every child as a parent and bounce them to the marketing page.
 */
export type Role = "student" | "parent" | "teacher" | "owner";
