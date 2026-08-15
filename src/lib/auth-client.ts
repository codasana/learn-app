"use client";

import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * No baseURL: the auth API is always mounted on the same origin as the page,
 * so the browser's own origin is the right answer everywhere.
 *
 * This used to read NEXT_PUBLIC_APP_URL and fall back to localhost:3000, which
 * is wrong in more places than it is right. NEXT_PUBLIC_ values are baked in
 * at build time, so a single build can only ever be correct for one hostname —
 * and this app answers on several: englishladder.vercel.app, the project's own
 * englishladder-two.vercel.app, a fresh per-deployment URL on every push, and
 * localhost on whichever port Next could get. On any of the others, sign-in
 * and sign-out would go cross-origin to a host that isn't listening.
 */
export const authClient = createAuthClient({
  plugins: [usernameClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
