import Link from "next/link";

import { brand } from "@/lib/brand";

/**
 * Site header. A wordmark in the display face and nothing else — no logo mark,
 * because the name is a placeholder and a mark drawn for a placeholder is
 * effort spent twice. Renaming stays a single edit to lib/brand.ts.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-[var(--border)]">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight"
        >
          {brand.name}
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/check" className="hover:text-[var(--primary)]">
            Free check
          </Link>
          <Link
            href="/login"
            className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[var(--border)] bg-[var(--surface-sunken)]">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
              {brand.name}
            </p>
            <p className="mt-1 max-w-sm text-sm text-[var(--ink-muted)]">
              {brand.tagline}
            </p>
          </div>
          <nav className="flex flex-col gap-2 text-sm">
            <Link href="/check" className="hover:text-[var(--primary)]">
              Check your child&rsquo;s English
            </Link>
            <Link href="/login" className="hover:text-[var(--primary)]">
              Sign in
            </Link>
          </nav>
        </div>
        <p className="mt-10 text-sm text-[var(--ink-faint)]">
          {brand.legalEntity} · {brand.legalCity}
        </p>
      </div>
    </footer>
  );
}
