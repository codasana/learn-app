/**
 * Hand-drawn marks.
 *
 * This is where the page gets to be fun. Not with cartoons — a parent choosing
 * a teacher for a nine-year-old is put off by those — but with the marks a
 * teacher actually makes: a word circled, a line underlined, a note in the
 * margin. It reads as delighted about children without ever drawing one.
 *
 * All of them are deliberately imperfect. A geometrically perfect underline
 * looks like a border; a slightly wobbly one looks like a person did it.
 */

/**
 * Sits under a word or two. Wrap the word in a `relative inline-block` span.
 *
 * The offsets are in `em` and tuned to clear a descender — an underline that
 * clips the tail of a "y" reads as a strikethrough, which says the opposite of
 * what a teacher's underline means. Stroke width is low because
 * `preserveAspectRatio="none"` stretches it: the rendered weight is roughly
 * the geometric mean of the two scales, so it comes out thicker than it looks
 * here.
 */
export function Underline({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 12"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute -bottom-[0.22em] left-0 h-[0.3em] w-full ${className}`}
    >
      <path
        d="M2 8.5c34-4.2 74-6 118-5.2 26 .5 52 2.4 78 5.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A loose ring around a word. */
export function CircleMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 220 70"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute -inset-x-[0.35em] -top-[0.12em] -bottom-[0.2em] h-[calc(100%+0.32em)] w-[calc(100%+0.7em)] ${className}`}
    >
      <path
        d="M112 5C63 3 12 14 7 34c-4 17 38 31 104 31 55 0 104-11 106-29C219 18 172 7 112 5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A short arrow pointing down-right, for margin notes. */
export function Squiggle({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 60 40"
      className={`pointer-events-none h-10 w-14 ${className}`}
    >
      <path
        d="M4 4c14 2 26 10 32 22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M28 27l9 1 -3-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A slot where a photograph will go.
 *
 * Photographs are deferred, and the honest thing is a shape that looks
 * deliberate rather than broken — no grey box, no stock face, no "image
 * coming soon". It carries the page's own colours and reads as a designed
 * panel until a real picture replaces it.
 */
export function PhotoSlot({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--primary-soft)] ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 400 400"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        <rect width="400" height="400" fill="var(--primary-soft)" />
        <circle cx="300" cy="110" r="90" fill="var(--accent-soft)" />
        <path
          d="M0 300c70-40 130-40 200 0s130 40 200 0v100H0Z"
          fill="var(--primary)"
          opacity="0.12"
        />
        <path
          d="M0 340c70-40 130-40 200 0s130 40 200 0v60H0Z"
          fill="var(--accent)"
          opacity="0.16"
        />
      </svg>
    </div>
  );
}
