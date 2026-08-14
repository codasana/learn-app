/**
 * Soft colour panels.
 *
 * These are decoration, not placeholders waiting to be filled. The design
 * rests on large calm areas of colour, and these blocks are that idea doing
 * its job — the page is finished as it stands. If real photographs arrive one
 * day they can take these frames, but nothing here is pretending to be a gap.
 *
 * They carry no information, so they are hidden from screen readers entirely.
 * Announcing a decorative rectangle is noise to someone using one.
 */

const TONES = {
  lilac: "var(--panel-lilac)",
  peach: "var(--panel-peach)",
  mint: "var(--panel-mint)",
  butter: "var(--panel-butter)",
  white: "var(--surface)",
} as const;

export type Tone = keyof typeof TONES;

export function Panel({
  tone = "lilac",
  className = "",
}: {
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-[var(--radius-card)] ${className}`}
      style={{ background: TONES[tone] }}
    />
  );
}

/** The four-up arrangement used beside the hero. */
export function PanelCluster({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`grid grid-cols-2 gap-4 ${className}`}>
      <Panel tone="peach" className="aspect-square w-full" />
      <Panel tone="mint" className="mt-8 aspect-square w-full" />
      <Panel tone="white" className="aspect-square w-full" />
      <Panel tone="butter" className="mt-8 aspect-square w-full" />
    </div>
  );
}
