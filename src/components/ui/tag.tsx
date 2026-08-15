import Link from "next/link";

/**
 * A tag, drawn as a tag.
 *
 * Tags were joined with " · " and rendered as muted text, which makes
 * "past tense · animals · at home" read as one phrase rather than three
 * things. Since tags are the only way content is organised now that levels
 * are gone, their edges have to be visible.
 *
 * Clicking one filters the list by it — the tag you can see is the tag you
 * can act on.
 */
export function Tag({ tag, href }: { tag: string; href?: string }) {
  const className =
    "inline-flex items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-sunken)] px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-[var(--ink-muted)]";

  if (!href) return <span className={className}>{tag}</span>;

  return (
    <Link
      href={href}
      className={`${className} transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--ink)]`}
    >
      {tag}
    </Link>
  );
}

/** A row of them, wrapping, with an em dash when there are none. */
export function TagList({
  tags,
  hrefFor,
}: {
  tags: string[];
  hrefFor?: (tag: string) => string;
}) {
  if (tags.length === 0) {
    return <span className="text-[var(--ink-faint)]">—</span>;
  }

  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Tag key={tag} tag={tag} href={hrefFor?.(tag)} />
      ))}
    </span>
  );
}
