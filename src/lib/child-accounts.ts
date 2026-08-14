import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { childProfiles, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  hasRealEmail,
  normaliseUsername,
  placeholderEmailFor,
  validateUsername,
} from "@/lib/users";

export type ChildAccountResult =
  | { ok: true; username: string }
  | { ok: false; error: string };

/**
 * Creates a sign-in for a child. Only the child's own parent may call this —
 * the caller passes the parent's id and it is checked against the profile.
 *
 * `email` is optional on purpose: a child with no email gets a non-routable
 * placeholder (see src/lib/users.ts). The parent's email stays the contact of
 * record either way, which is what keeps this the minimal-data option.
 */
export async function createChildLogin({
  parentId,
  childId,
  username: rawUsername,
  password,
  email,
}: {
  parentId: string;
  childId: string;
  username: string;
  password: string;
  email?: string | null;
}): Promise<ChildAccountResult> {
  const child = await db.query.childProfiles.findFirst({
    where: eq(childProfiles.id, childId),
  });

  if (!child || child.parentId !== parentId) {
    return { ok: false, error: "That child isn't on your account." };
  }
  if (child.userId) {
    return { ok: false, error: `${child.firstName} already has a sign-in.` };
  }

  const username = normaliseUsername(rawUsername);
  const usernameError = validateUsername(username);
  if (usernameError) return { ok: false, error: usernameError };

  if (password.length < 8) {
    return { ok: false, error: "Passwords need at least 8 characters." };
  }

  const taken = await db.query.users.findFirst({
    where: eq(users.username, username),
  });
  if (taken) {
    return { ok: false, error: "That username is taken. Try another." };
  }

  const loginEmail =
    email && hasRealEmail(email)
      ? email.toLowerCase()
      : placeholderEmailFor(username);

  // Go through Better Auth so the password hash matches what sign-in verifies.
  // `username` comes from the username plugin, which the inferred body type for
  // signUpEmail does not pick up, hence the cast.
  const created = (await auth.api.signUpEmail({
    body: {
      email: loginEmail,
      password,
      name: child.firstName,
      username,
    },
  } as never)) as unknown as { user: { id: string } };

  const newUserId = created.user.id;

  // `role` is `input: false` in the auth config, so it can only be set here,
  // server-side. A student must never be able to reach parent or teacher routes.
  await db
    .update(users)
    .set({ role: "student", displayUsername: rawUsername.trim() })
    .where(eq(users.id, newUserId));

  await db
    .update(childProfiles)
    .set({ userId: newUserId })
    .where(eq(childProfiles.id, childId));

  return { ok: true, username };
}

/**
 * Parents can reset their child's password at any time — children forget them,
 * and the alternative is that every reset lands on the teacher.
 */
export async function resetChildPassword({
  parentId,
  childId,
  newPassword,
}: {
  parentId: string;
  childId: string;
  newPassword: string;
}): Promise<ChildAccountResult> {
  const child = await db.query.childProfiles.findFirst({
    where: eq(childProfiles.id, childId),
  });

  if (!child || child.parentId !== parentId) {
    return { ok: false, error: "That child isn't on your account." };
  }
  if (!child.userId) {
    return {
      ok: false,
      error: `${child.firstName} doesn't have a sign-in yet.`,
    };
  }
  if (newPassword.length < 8) {
    return { ok: false, error: "Passwords need at least 8 characters." };
  }

  const ctx = await auth.$context;
  const hash = await ctx.password.hash(newPassword);
  await ctx.internalAdapter.updatePassword(child.userId, hash);

  const account = await db.query.users.findFirst({
    where: eq(users.id, child.userId),
  });

  return { ok: true, username: account?.username ?? "" };
}
