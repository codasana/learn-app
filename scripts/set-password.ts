/**
 * Sets a staff password from the terminal.
 *
 *   npx tsx scripts/set-password.ts <email> <new-password>
 *
 * A temporary door until there is a proper account-settings screen. Parents
 * will never need this — they get a reset link — and children's passwords are
 * reset by their parent (see src/lib/child-accounts.ts).
 */
import { config } from "dotenv";
import Module from "node:module";

config({ path: ".env.local" });

// `server-only` throws outside Next's bundler; stub it so this can run.
const origLoad = (Module as unknown as { _load: (...a: unknown[]) => unknown })
  ._load;
(Module as unknown as { _load: unknown })._load = function (
  req: string,
  ...rest: unknown[]
) {
  if (req === "server-only") return {};
  return (origLoad as (...a: unknown[]) => unknown).call(this, req, ...rest);
};

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/set-password.ts <email> <password>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Passwords need at least 8 characters.");
    process.exit(1);
  }

  const { db } = await import("../src/db");
  const { users } = await import("../src/db/schema");
  const { auth } = await import("../src/lib/auth");
  const { eq } = await import("drizzle-orm");

  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
  if (!user) {
    console.error(`No account found for ${email}.`);
    process.exit(1);
  }

  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(
    user.id,
    await ctx.password.hash(password),
  );

  console.log(`\n  Password updated for ${email} (role: ${user.role}).\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
