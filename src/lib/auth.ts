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
/**
 * Every origin this app legitimately answers on.
 *
 * The origin check is what stops another site driving a signed-in browser
 * through our auth endpoints, so the list has to be exact — but it also has to
 * be complete, because an origin missing from it fails as INVALID_ORIGIN,
 * which reads like broken credentials rather than a configuration problem.
 * That is a miserable ten minutes to spend, and I have already spent it once.
 *
 * In development the port is not ours to choose: Next takes 3001 when
 * something else already holds 3000.
 *
 * In production the hostname is not ours to choose either. Vercel serves the
 * same build on the production domain, on the project's own <name>.vercel.app,
 * and on a fresh per-deployment URL every push. Vercel names each of them in
 * the environment, so they are read rather than guessed — nothing is trusted
 * that Vercel has not said is ours.
 */
function trustedOrigins(): string[] {
  if (process.env.NODE_ENV === "development") {
    return [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
    ];
  }

  const hosts = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  ].filter((h): h is string => Boolean(h));

  const origins = hosts.map((h) => `https://${h}`);
  if (process.env.BETTER_AUTH_URL) origins.push(process.env.BETTER_AUTH_URL);

  return [...new Set(origins)];
}

export const auth = betterAuth({
  trustedOrigins: trustedOrigins(),

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
      /*
       * `input: false` stops a user writing this. `returned: false` stops
       * Better Auth putting it in the session payload, which it otherwise
       * does — the hash was going out in the sign-in response. It guards four
       * digits, so a hash in the child's browser is the same as no PIN.
       */
      pinHash: {
        type: "string",
        required: false,
        input: false,
        returned: false,
      },
      timezone: {
        type: "string",
        required: false,
        defaultValue: "Asia/Kolkata",
      },
      /* A parent's phone number is not the child's business either. */
      whatsapp: { type: "string", required: false, returned: false },
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
