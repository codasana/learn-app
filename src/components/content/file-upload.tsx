"use client";

import { useRef, useState } from "react";

import { signUpload } from "@/app/(teacher)/teacher/content/upload-actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/field";

/**
 * Attaches one file to a content item.
 *
 * The upload goes straight from the browser to R2 using a URL signed by the
 * server — the app never sees the bytes. That is what makes a 40MB slide deck
 * a non-event.
 *
 * Progress is real, not a spinner pretending. Sheeba will be uploading decks
 * over Indian home broadband; a bar that actually moves is the difference
 * between waiting and assuming it has hung.
 */

const ACCEPT: Record<string, string> = {
  slides: "application/pdf",
  worksheet: "application/pdf",
  image: "image/png,image/jpeg,image/webp,image/gif",
  audio: "audio/*",
  listening: "audio/*",
  video: "video/mp4,video/webm,video/quicktime",
};

const HINT: Record<string, string> = {
  slides: "A PDF. Export it from PowerPoint: File → Export → PDF.",
  worksheet: "A PDF. Export from Word or Pages, or scan it.",
  image: "PNG, JPEG or WebP.",
  audio: "MP3 or M4A. A voice memo from your phone is fine.",
  listening: "MP3 or M4A. A voice memo from your phone is fine.",
  video: "MP4. Keep it short — under a few minutes.",
};

export function FileUpload({
  type,
  fileUrl,
  onChange,
}: {
  type: string;
  fileUrl: string | null;
  onChange: (fileUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setProgress(0);

    const signed = await signUpload({
      type,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    });

    if (!signed.ok) {
      setProgress(null);
      setError(signed.error);
      return;
    }

    // XHR rather than fetch: fetch still cannot report upload progress.
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.uploadUrl);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        onChange(signed.fileUrl);
      } else {
        setError("The upload didn't finish. Try that once more.");
      }
    };

    xhr.onerror = () => {
      setProgress(null);
      setError("The upload didn't finish — check your connection and retry.");
    };

    xhr.send(file);
  }

  const name = fileUrl
    ? decodeURIComponent(fileUrl.split("/").pop() ?? "file")
    : null;

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[type] ?? undefined}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />

      {error ? <Notice>{error}</Notice> : null}

      {progress !== null ? (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-[var(--ink-muted)]">
            Uploading… {progress}%
          </p>
        </div>
      ) : fileUrl ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate font-medium text-[var(--primary)] hover:underline"
          >
            {name}
          </a>
          <Button
            type="button"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
          >
            Replace
          </Button>
          <Button
            type="button"
            variant="quiet"
            onClick={() => onChange(null)}
          >
            Remove
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
          >
            Choose a file
          </Button>
          {HINT[type] ? (
            <p className="text-sm text-[var(--ink-muted)]">{HINT[type]}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
