import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";

import { db, schema } from "@/db";

/**
 * The parent is the paying account holder — billing, reports, and the consent
 * record always live there.
 *
 * A child may ALSO have their own sign-in, created by the parent: a username,
 * a password, and an optional email. Both routes work — a child can sign in
 * directly, or enter through the parent's session and the profile picker.
 * See src/lib/users.ts for why a child's email is optional by default.
 *
 * There is no public sign-up. Parents are invited after enrolling; children are
 * created by their parent; staff come from scripts/seed-owner.ts.
 *
 * The 4-digit PIN gating the exit from kid mode is NOT an auth concern — it is
 * a UI gate over `users.pinHash` (see src/lib/pin.ts).
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  socialProviders:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined,

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "parent",
        // A user must never be able to promote themselves to teacher/owner.
        input: false,
      },
      pinHash: { type: "string", required: false, input: false },
      timezone: {
        type: "string",
        required: false,
        defaultValue: "Asia/Kolkata",
      },
      whatsapp: { type: "string", required: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days — parents should stay logged in
    updateAge: 60 * 60 * 24,
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
  },

  plugins: [
    // Lets a child sign in with the username their parent set, rather than an
    // email they may not have.
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
