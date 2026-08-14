/**
 * Creates the owner account. There is no public sign-up (see spec §13D), so
 * staff accounts can only come from here.
 *
 *   npx tsx scripts/seed-owner.ts <email> [role]
 *
 * Prints a one-time password to the terminal — it is never emailed and never
 * stored in plain text. Change it after the first login.
 */
import { randomBytes } from "node:crypto";

import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

async function main() {
  const email = process.argv[2];
  const role = (process.argv[3] ?? "owner") as "owner" | "teacher";

  if (!email) {
    console.error("Usage: npx tsx scripts/seed-owner.ts <email> [owner|teacher]");
    process.exit(1);
  }
  if (role !== "owner" && role !== "teacher") {
    console.error("Role must be 'owner' or 'teacher'.");
    process.exit(1);
  }

  // Imported lazily so dotenv has already run before the db module reads env.
  const { db } = await import("../src/db");
  const { users } = await import("../src/db/schema");
  const { auth } = await import("../src/lib/auth");

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    await db.update(users).set({ role }).where(eq(users.email, email));
    console.log(`Updated ${email} → role "${role}". Password unchanged.`);
    process.exit(0);
  }

  // base64url, so the password is safe to paste anywhere.
  const password = randomBytes(12).toString("base64url");

  // Go through Better Auth rather than inserting directly, so the password is
  // hashed with the same algorithm the login path verifies against.
  await auth.api.signUpEmail({
    body: { email, password, name: email.split("@")[0] },
  });

  // `role` is `input: false` in the auth config precisely so it cannot be set
  // from a request. Setting it here, server-side, is the only way in.
  await db.update(users).set({ role }).where(eq(users.email, email));

  console.log("");
  console.log(`  Created ${role} account`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log("");
  console.log("  Change this after first login. It is not stored anywhere else.");
  console.log("");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
