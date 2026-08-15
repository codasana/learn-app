import Link from "next/link";

/**
 * A way out of every activity.
 *
 * "No navigation" was meant to be "no menu" — a child gets one thing at a time
 * rather than a set of tabs to wander around. It is not meant to be no exit. A
 * child who opens something and changes their mind, or opens the wrong card,
 * or simply wants to stop, must be able to leave without knowing what a
 * browser back button is.
 *
 * It lives in a layout rather than in each player so a new activity type
 * cannot ship without one.
 *
 * Nothing is lost by leaving: activities record on finish, and the writing box
 * keeps whatever was sent. Half-done work is simply not-done, which is easier
 * to explain to a child than a half-saved state.
 */
export default function ActivityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-md px-6 pt-6">
        <Link
          href="/learn"
          className="inline-flex min-h-[var(--tap-target)] items-center gap-2 rounded-[var(--radius)] px-3 text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
        >
          <span aria-hidden="true">←</span>
          Today
        </Link>
      </div>
      {children}
    </div>
  );
}
