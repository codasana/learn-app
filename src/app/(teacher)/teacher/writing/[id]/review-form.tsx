"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Notice, Textarea } from "@/components/ui/field";

import { releaseFeedback, saveFeedback, unrelease } from "../actions";

/**
 * Writing back to a child.
 *
 * Two buttons, and the difference between them is the whole point. Saving
 * keeps the work; sending is the only thing that makes a response visible to a
 * child, and it is always a person pressing it.
 *
 * The task's own feedback focus is shown while she writes — "capital letters
 * and full stops only" — because the instruction she set herself in August is
 * exactly what she will have forgotten by November, and marking everything is
 * how a nine-year-old stops wanting to write.
 */
export function ReviewForm({
  id,
  childName,
  status,
  feedback,
  focus,
  releasedAt,
}: {
  id: string;
  childName: string;
  status: string;
  feedback: string;
  focus: string;
  releasedAt: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState(feedback);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sent = status === "released" || status === "redrafted";

  async function run(
    fn: (id: string, fd: FormData) => Promise<{ ok: boolean; error?: string }>,
    note: string,
  ) {
    setPending(true);
    setMessage(null);
    const fd = new FormData();
    fd.set("teacherFeedback", text);
    const res = await fn(id, fd);
    setPending(false);
    setMessage(res.ok ? note : (res.error ?? "That didn't work."));
    router.refresh();
  }

  return (
    <section className="space-y-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
      {sent ? (
        <div className="rounded-[var(--radius)] bg-[var(--correct-soft)] px-4 py-3">
          <p className="font-medium text-[var(--correct)]">
            Sent to {childName}
            {releasedAt
              ? ` on ${new Date(releasedAt).toLocaleDateString("en-GB")}`
              : ""}
          </p>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            They can see this now, on the piece they wrote.
          </p>
        </div>
      ) : (
        <p className="text-sm text-[var(--ink-muted)]">
          {childName} sees nothing until you send it.
        </p>
      )}

      {message ? <Notice>{message}</Notice> : null}

      <Field
        label={`What to say to ${childName}`}
        htmlFor="teacherFeedback"
        hint={
          focus
            ? `You set this task to mark: ${focus}`
            : "Say what went well first. It is the part they read."
        }
      >
        <Textarea
          id="teacherFeedback"
          name="teacherFeedback"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`You told me three things and I could picture all of them…`}
        />
      </Field>

      <div className="flex flex-wrap gap-3">
        {!sent && (
          <>
            <Button
              disabled={pending || !text.trim()}
              onClick={() => run(releaseFeedback, `Sent to ${childName}.`)}
            >
              {pending ? "Working…" : `Send it to ${childName}`}
            </Button>
            <Button
              variant="secondary"
              disabled={pending || !text.trim()}
              onClick={() => run(saveFeedback, "Saved. Not sent yet.")}
            >
              Save for later
            </Button>
          </>
        )}

        {sent && (
          <>
            <Button
              disabled={pending || !text.trim()}
              onClick={() => run(releaseFeedback, "Updated.")}
            >
              {pending ? "Working…" : "Save the change"}
            </Button>
            <Button
              variant="quiet"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                await unrelease(id);
                setPending(false);
                setMessage("Back in your list. They can no longer see it.");
                router.refresh();
              }}
            >
              Take it back
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
