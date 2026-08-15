import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";

/**
 * Creates an account for somebody else, without signing anybody in.
 *
 * This exists because `auth.api.signUpEmail` does what its name says: it signs
 * the caller up, and with the `nextCookies()` plugin it writes a session cookie
 * onto the response. In a server action run by a signed-in teacher that is a
 * quiet disaster — she creates a parent account and is instantly signed out and
 * signed in as that parent, holding their session.
 *
 * Every account in this system is made for someone else: there is no public
 * sign-up (spec §13D). The teacher creates the parent, the parent creates the
 * child. So the session-creating path is never the one we want, and going
 * through the internal adapter avoids it entirely.
 *
 * The password is hashed by Better Auth's own hasher, so sign-in verifies it
 * exactly as it would any other account.
 */
export async function createAccount({
  email,
  name,
  password,
  role,
  username,
  displayUsername,
  timezone,
  whatsapp,
}: {
  email: string;
  name: string;
  password: string;
  role: "parent" | "student" | "teacher" | "owner";
  username?: string;
  displayUsername?: string;
  timezone?: string;
  whatsapp?: string | null;
}): Promise<{ id: string }> {
  const ctx = await auth.$context;

  const user = await ctx.internalAdapter.createUser({
    email: email.toLowerCase(),
    name,
    emailVerified: false,
  });

  const hash = await ctx.password.hash(password);
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hash,
  });

  /*
   * `role` is `input: false` in the auth config so no request can ever grant
   * itself one. It is set here, server-side, along with the fields the
   * username plugin owns — writing them directly keeps this the single place
   * that decides what a new account is allowed to be.
   */
  await db
    .update(users)
    .set({
      role,
      ...(username ? { username } : {}),
      ...(displayUsername ? { displayUsername } : {}),
      ...(timezone ? { timezone } : {}),
      ...(whatsapp !== undefined ? { whatsapp } : {}),
    })
    .where(eq(users.id, user.id));

  return { id: user.id };
}
