import Link from "next/link";

/**
 * An honest placeholder. A nav link that 404s is worse than one that explains
 * itself — and this keeps the shape of the app visible while it is being built.
 */
export function ComingSoon({
  title,
  what,
  when,
  nextHref,
  nextLabel,
}: {
  title: string;
  what: string;
  when: string;
  nextHref?: string;
  nextLabel?: string;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="max-w-xl rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-8">
        <p className="font-medium">Not built yet.</p>
        <p className="mt-2 text-[var(--ink-muted)]">{what}</p>
        <p className="mt-2 text-sm text-[var(--ink-faint)]">{when}</p>
        {nextHref && nextLabel ? (
          <Link
            href={nextHref}
            className="mt-4 inline-block rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 font-medium text-white"
          >
            {nextLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
