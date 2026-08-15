import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser, homeFor } from "@/lib/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Already signed in: send them where they belong, not to the marketing
  // page. Same rule as the login form and the role guards.
  const user = await getCurrentUser();
  if (user) redirect(homeFor((user as { role?: string }).role));

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--ink)]">Sign in</h1>
        <p className="text-[var(--ink-muted)]">
          Parents, use your email address. Children, use the username your
          parent set up for you.
        </p>
      </div>

      <LoginForm />

      <p className="text-sm text-[var(--ink-muted)]">
        Accounts are created when a child joins the programme. If you are trying
        to start, book a free session instead and we will set things up for you.
      </p>
    </main>
  );
}
