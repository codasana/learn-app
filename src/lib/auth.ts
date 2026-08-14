import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db, schema } from "@/db";

/**
 * The parent is the account holder. Children are rows in `child_profiles`
 * owned by the parent — they never have emails or passwords.
 *
 * The 4-digit PIN that gates the exit from kid mode is NOT an auth concern;
 * it is a UI gate built on `users.pinHash` (see src/lib/pin.ts).
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

  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
