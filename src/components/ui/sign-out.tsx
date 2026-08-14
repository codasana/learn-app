"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { signOut } from "@/lib/auth-client";

/**
 * `router.refresh()` after the push matters: without it the server components
 * for the signed-in shell stay in the router cache, and going back lands on a
 * stale page that looks signed in. On a shared family laptop that is the whole
 * point of signing out.
 */
export function SignOut({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOut();
        router.push("/login");
        router.refresh();
      }}
      className={
        className ??
        "rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)] disabled:opacity-50"
      }
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
