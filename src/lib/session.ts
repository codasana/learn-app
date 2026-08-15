import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { homeFor } from "@/lib/home-for";
import type { Role } from "@/lib/roles";

export type { Role } from "@/lib/roles";
export { homeFor } from "@/lib/home-for";

export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Role gate for the teacher/owner surfaces. Every teacher route must call this
 * — never rely on the client hiding a link.
 */
export async function requireRole(...allowed: Role[]) {
  const user = await requireUser();
  const role = (user as { role?: Role }).role ?? "parent";
  // Bounce them to their own screen rather than the marketing page — a child
  // who follows a stale /teacher link should land back in /learn, not outside.
  if (!allowed.includes(role)) redirect(homeFor(role));
  return { ...user, role };
}

export async function requireTeacher() {
  return requireRole("teacher", "owner");
}
