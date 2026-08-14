import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export type Role = "parent" | "teacher" | "owner";

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
  if (!allowed.includes(role)) redirect("/");
  return { ...user, role };
}

export async function requireTeacher() {
  return requireRole("teacher", "owner");
}
