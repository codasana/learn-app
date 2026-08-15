"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Notice } from "@/components/ui/field";
import { signIn } from "@/lib/auth-client";
import { homeFor } from "@/lib/home-for";

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const identifier = String(form.get("identifier") ?? "").trim();
    const password = String(form.get("password") ?? "");

    // Parents and staff sign in with an email; children sign in with the
    // username their parent set for them, since they may have no email at all.
    const { data, error } = identifier.includes("@")
      ? await signIn.email({ email: identifier, password })
      : await signIn.username({ username: identifier.toLowerCase(), password });

    setPending(false);

    if (error) {
      // Deliberately does not distinguish "no such account" from "wrong
      // password" — that difference tells an attacker which accounts exist.
      setMessage("That didn't match. Please check and try again.");
      return;
    }

    // Straight to their own screen. Landing everyone on the marketing page
    // made Sheeba sign in and then go looking for her classes.
    const role = (data?.user as { role?: string } | undefined)?.role;
    router.push(homeFor(role));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {message ? <Notice>{message}</Notice> : null}

      <Field
        label="Email or username"
        htmlFor="identifier"
        hint="Parents use their email. Children use the username their parent set up."
      >
        <Input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
