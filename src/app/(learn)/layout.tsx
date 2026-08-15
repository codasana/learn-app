import { requireLearner } from "@/lib/child-session";

/**
 * The child's shell.
 *
 * `data-surface="kid"` lifts body text to 18px and every tap target to 48px;
 * `data-age-band` swaps rounding and celebration intensity. Both are token
 * switches in globals.css, so this is the same component library the teacher
 * uses, dressed differently — not a second design system to keep in sync.
 *
 * There is deliberately no navigation. A child gets one thing to do at a time;
 * a menu is a way to be somewhere other than the thing you were asked to do.
 */
export default async function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const learner = await requireLearner();

  return (
    <div
      data-surface="kid"
      data-age-band={learner.ageBand}
      className="flex min-h-full flex-1 flex-col"
    >
      {children}
    </div>
  );
}
