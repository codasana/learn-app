/**
 * A panel where a photograph will eventually go.
 *
 * Photographs are deferred, and the honest thing is a shape that looks
 * deliberate rather than broken — no grey box, no stock face, no "image
 * coming soon". Each slot is one of the page's own soft colours, so an
 * unfilled layout still reads as designed. When a real picture arrives it
 * drops into the same rounded frame and nothing else moves.
 */

const TONES = {
  lilac: "var(--panel-lilac)",
  peach: "var(--panel-peach)",
  mint: "var(--panel-mint)",
  butter: "var(--panel-butter)",
  white: "var(--surface)",
} as const;

export type Tone = keyof typeof TONES;

export function PhotoSlot({
  label,
  tone = "lilac",
  className = "",
}: {
  /** What the photograph will show. Read out by screen readers today. */
  label: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`rounded-[var(--radius-card)] ${className}`}
      style={{ background: TONES[tone] }}
    />
  );
}

/** The four-up arrangement used beside the hero. */
export function PhotoCluster({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`}>
      <PhotoSlot
        label="A child in a live class"
        tone="peach"
        className="aspect-square w-full"
      />
      <PhotoSlot
        label="A page of a child's writing"
        tone="mint"
        className="mt-8 aspect-square w-full"
      />
      <PhotoSlot
        label="The teacher during a lesson"
        tone="white"
        className="aspect-square w-full"
      />
      <PhotoSlot
        label="A child reading"
        tone="butter"
        className="mt-8 aspect-square w-full"
      />
    </div>
  );
}
