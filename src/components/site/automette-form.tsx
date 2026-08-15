"use client";

import { useEffect, useRef, useState } from "react";

/**
 * An Automette form, embedded and self-sizing.
 *
 * Automette posts `{ type: "automette:height", height }` on load, on every
 * change, and after submit. Two things about that are worth writing down
 * because both are easy to get wrong:
 *
 *  - **Keep listening.** The height genuinely changes after first paint — the
 *    web font loads and reflows it. Automette's own measurements went
 *    900 → 611 → 702. Taking the first message leaves a form in a box the
 *    wrong size.
 *
 *  - **Check the origin.** Their example does not, and `message` events arrive
 *    from anywhere: any script on this page, or any frame, can post one. The
 *    worst case here is a silly iframe height rather than anything dangerous,
 *    but the check costs one line and this is the habit that matters when the
 *    payload is not a number.
 *
 * A sensible starting height means the page does not jump when the first
 * message lands, and the form still works if no message ever arrives.
 */
export function AutometteForm({
  src,
  title,
  initialHeight = 900,
}: {
  src: string;
  title: string;
  initialHeight?: number;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(initialHeight);

  useEffect(() => {
    let origin: string;
    try {
      origin = new URL(src).origin;
    } catch {
      return;
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== origin) return;
      if (event.source !== frame.current?.contentWindow) return;

      const data = event.data as { type?: string; height?: unknown };
      if (data?.type !== "automette:height") return;

      const next = Number(data.height);
      // A form shorter than this is a rendering failure, not a short form.
      if (Number.isFinite(next) && next > 100) setHeight(Math.ceil(next));
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [src]);

  return (
    <iframe
      ref={frame}
      src={src}
      title={title}
      height={height}
      // Nothing here needs any of it, and a form asking for the camera would
      // be a surprise worth preventing rather than explaining.
      allow=""
      referrerPolicy="no-referrer"
      className="w-full rounded-[var(--radius-card)] border-0 bg-transparent transition-[height] duration-200"
    />
  );
}
