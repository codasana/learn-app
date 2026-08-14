import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";

/**
 * Placeholder home page. The real marketing page arrives in M3 alongside the
 * placement flow. Copy already follows docs/design-and-copy.md — plain and
 * explanatory, no urgency, no superlatives, no name-based metaphor.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[var(--content-max)] flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-4">
        <p className="text-sm font-medium tracking-wide text-[var(--ink-faint)] uppercase">
          {brand.name}
        </p>
        <h1 className="text-4xl leading-tight font-semibold text-balance text-[var(--ink)]">
          Live English classes for children, with daily practice in between.
        </h1>
        <p className="text-lg text-[var(--ink-muted)]">
          Two classes a week with a teacher who knows your child by name, and
          about ten minutes of practice a day. We start with a free session to
          work out the right place to begin.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button>See how placement works</Button>
        <Button variant="secondary">Sign in</Button>
      </div>

      <p className="text-sm text-[var(--ink-faint)]">
        A program by {brand.legalEntity}, {brand.legalCity}.
      </p>
    </main>
  );
}
