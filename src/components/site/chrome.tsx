import Link from "next/link";

import { brand } from "@/lib/brand";
import { homeFor } from "@/lib/home-for";
import { getCurrentUser } from "@/lib/session";

/**
 * Site header. A wordmark and nothing else — no logo mark, because the name is
 * a placeholder and a mark drawn for a placeholder is effort spent twice.
 * Renaming stays a single edit to lib/brand.ts.
 *
 * It reads the session, because a header that offers "Sign in" to someone who
 * is already signed in tells them the sign-in did not work.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();
  const role = (user as { role?: string } | null)?.role;

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href={user ? homeFor(role) : "/"}
          className="rounded-[var(--radius)] text-xl font-bold tracking-tight transition-colors hover:text-[var(--primary)]"
        >
          {brand.name}
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {user ? (
            <>
              <span className="hidden px-2 text-[var(--ink-faint)] sm:inline">
                {user.name}
              </span>
              <NavLink href={homeFor(role)} primary>
                {role === "teacher" || role === "owner"
                  ? "Go to teaching"
                  : role === "student"
                    ? "Go to learning"
                    : "Your account"}
              </NavLink>
            </>
          ) : (
            <>
              <NavLink href="/check">Free check</NavLink>
              <NavLink href="/login">Sign in</NavLink>
              <NavLink href="/book" primary>
                Book a free class
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

/**
 * One shape for every header link, so the row reads as a row. `primary` is the
 * single filled pill — more than one and neither of them is the next step.
 */
function NavLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "rounded-[var(--radius-lg)] bg-[var(--primary)] px-4 py-2 font-medium text-[var(--ink-on-primary)] transition-opacity hover:opacity-90"
          : "rounded-[var(--radius-lg)] px-3 py-2 text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
      }
    >
      {children}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[var(--border)] bg-[var(--surface-sunken)]">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <p className="text-lg font-bold">{brand.name}</p>
            <p className="mt-1 max-w-sm text-sm text-[var(--ink-muted)]">
              {brand.tagline}
            </p>
          </div>
          <nav className="flex flex-col gap-2 text-sm">
            <Link href="/check" className="hover:text-[var(--primary)]">
              Check your child&rsquo;s English
            </Link>
            <Link href="/book" className="hover:text-[var(--primary)]">
              Book a free class
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
