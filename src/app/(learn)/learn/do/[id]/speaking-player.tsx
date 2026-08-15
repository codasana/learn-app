"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { submit } from "./actions";
import { signSubmissionUpload } from "./upload-actions";

type Existing = {
  status: string;
  feedback: string | null;
  seconds: number | null;
};

/**
 * The child records themselves, listens back, and sends it.
 *
 * Listening back before sending is the whole design. A child who cannot undo
 * a recording will not make one — the first attempt is always the frightening
 * one, and "try again" has to be the easiest button on the screen. So nothing
 * leaves the device until they press send.
 */
export function SpeakingPlayer({
  id,
  title,
  prompt,
  planningBoxes,
  maxSeconds,
  existing,
}: {
  id: string;
  title: string;
  prompt: string;
  planningBoxes: string[];
  maxSeconds: number;
  existing: Existing | null;
}) {
  const [phase, setPhase] = useState<
    "idle" | "recording" | "review" | "sending" | "sent"
  >(existing ? "sent" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [clipUrl, setClipUrl] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const blob = useRef<Blob | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  // A live microphone and an object URL both outlive React if nobody stops
  // them. Leaving a child's mic open after they navigate away is the kind of
  // bug that is invisible in testing and inexcusable in the wild.
  useEffect(() => {
    return () => {
      if (tick.current) clearInterval(tick.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
      if (clipUrl) URL.revokeObjectURL(clipUrl);
    };
  }, [clipUrl]);

  async function start() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(
        "We couldn't use your microphone. Ask a grown-up to allow it, then try again.",
      );
      return;
    }

    chunks.current = [];
    const rec = new MediaRecorder(stream);
    recorder.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const b = new Blob(chunks.current, { type: rec.mimeType });
      blob.current = b;
      setClipUrl(URL.createObjectURL(b));
      setPhase("review");
    };

    rec.start();
    setSeconds(0);
    setPhase("recording");

    tick.current = setInterval(() => {
      setSeconds((s) => {
        // Stop ourselves at the cap rather than letting it run — the cap is
        // there to keep the task small, not to fail them at the end.
        if (s + 1 >= maxSeconds) stop();
        return s + 1;
      });
    }, 1000);
  }

  function stop() {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function again() {
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    setClipUrl(null);
    blob.current = null;
    setSeconds(0);
    setPhase("idle");
  }

  async function send() {
    const b = blob.current;
    if (!b) return;

    setPhase("sending");
    setError(null);

    const signed = await signSubmissionUpload({
      contentItemId: id,
      kind: "audio",
      contentType: b.type.split(";")[0],
      size: b.size,
    });
    if (!signed.ok) {
      setError(signed.error);
      setPhase("review");
      return;
    }

    const put = await fetch(signed.uploadUrl, {
      method: "PUT",
      body: b,
      headers: { "content-type": b.type.split(";")[0] },
    });
    if (!put.ok) {
      setError("That didn't send. Try again in a moment.");
      setPhase("review");
      return;
    }

    const res = await submit(id, {
      kind: "audio",
      mediaUrl: signed.key,
      seconds,
    });
    if (!res.ok) {
      setError(res.error ?? "That didn't send. Try again.");
      setPhase("review");
      return;
    }

    setPhase("sent");
  }

  const feedback =
    existing && (existing.status === "released" || existing.status === "redrafted")
      ? existing.feedback
      : null;

  return (
    <main className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-lg">{prompt}</p>

      {planningBoxes.filter(Boolean).length > 0 && phase !== "sent" && (
        <ul className="mt-6 space-y-2">
          {planningBoxes.filter(Boolean).map((box) => (
            <li
              key={box}
              className="rounded-[var(--radius)] bg-[var(--surface-sunken)] px-4 py-3"
            >
              {box}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-6 rounded-[var(--radius)] bg-[var(--panel-peach)] px-4 py-3">
          {error}
        </p>
      )}

      <div className="mt-8 space-y-4">
        {phase === "idle" && (
          <>
            <Button size="lg" className="w-full" onClick={start}>
              Start recording
            </Button>
            <p className="text-center text-sm text-[var(--ink-muted)]">
              You can listen to it and try again as many times as you like.
            </p>
          </>
        )}

        {phase === "recording" && (
          <>
            <p
              className="text-center text-5xl font-bold tabular-nums"
              aria-live="off"
            >
              {clock(seconds)}
            </p>
            <p className="text-center text-sm text-[var(--ink-muted)]">
              Recording — up to {clock(maxSeconds)}
            </p>
            <Button size="lg" className="w-full" onClick={stop}>
              I&rsquo;m finished
            </Button>
          </>
        )}

        {phase === "review" && clipUrl && (
          <>
            <p className="text-center text-[var(--ink-muted)]">
              Have a listen. Happy with it?
            </p>
            <audio controls src={clipUrl} className="w-full" />
            <Button size="lg" className="w-full" onClick={send}>
              Send it to my teacher
            </Button>
            <Button variant="quiet" className="w-full" onClick={again}>
              Record it again
            </Button>
          </>
        )}

        {phase === "sending" && (
          <p className="text-center text-lg">Sending…</p>
        )}

        {phase === "sent" && (
          <div className="rounded-[var(--radius-card)] bg-[var(--panel-mint)] px-5 py-6 text-center">
            <p className="text-lg font-medium">
              Your teacher has it{existing?.seconds ? ` — ${clock(existing.seconds)}` : ""}.
            </p>
            <p className="mt-1 text-[var(--ink-muted)]">
              {feedback
                ? "She has listened and written back."
                : "She will listen and write back to you."}
            </p>
            {feedback && (
              <p className="mt-4 rounded-[var(--radius)] bg-[var(--surface)] px-4 py-3 text-left">
                {feedback}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function clock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
