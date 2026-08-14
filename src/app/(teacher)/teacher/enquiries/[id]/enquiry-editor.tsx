"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Select, Textarea } from "@/components/ui/field";
import { toolTitle } from "@/lib/tools";

import { issueToolLink, updateEnquiry } from "../actions";

type Run = {
  id: string;
  tool: string;
  token: string;
  startedAt: string;
  completedAt: string | null;
  result: {
    total: number;
    outOf: number;
    sections: Record<string, { score: number; outOf: number }>;
    strongest: string;
    suggestedLevel: number;
  } | null;
};

const STATUSES = [
  ["new", "New"],
  ["class_scheduled", "Class booked"],
  ["class_done", "Class done"],
  ["report_sent", "Report sent"],
  ["enrolled", "Enrolled"],
  ["declined", "Not this time"],
  ["dormant", "Gone quiet"],
] as const;

export function EnquiryEditor({
  enquiry,
  runs,
  sectionLabels,
}: {
  enquiry: {
    id: string;
    status: string;
    suggestedLevel: number | null;
    startingLevel: number | null;
    teacherNotes: string;
    notes: string;
  };
  runs: Run[];
  sectionLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const res = await updateEnquiry(enquiry.id, new FormData(e.currentTarget));
    setPending(false);
    setMessage(res.ok ? "Saved." : res.error);
    router.refresh();
  }

  async function onIssue() {
    setPending(true);
    setMessage(null);
    const res = await issueToolLink(enquiry.id, "level_check");
    setPending(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    setIssued(`${window.location.origin}${res.url}`);
    setCopied(false);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {message ? <Notice>{message}</Notice> : null}

      {/* --- the checks they've done --- */}
      <section className="space-y-3">
        <div>
          <h2 className="font-medium">Checks</h2>
          <p className="text-sm text-[var(--ink-muted)]">
            Send a link and it arrives already tied to this family — no forms,
            no email asked for twice. Results land here when they finish.
          </p>
        </div>

        {runs.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">
            Nothing yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {runs.map((r) => (
              <li
                key={r.id}
                className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-medium">{toolTitle(r.tool)}</span>
                  <span className="text-sm text-[var(--ink-faint)]">
                    {r.completedAt
                      ? new Date(r.completedAt).toLocaleDateString("en-GB")
                      : "not finished yet"}
                  </span>
                </div>

                {r.result ? (
                  <div className="mt-1 text-sm text-[var(--ink-muted)]">
                    <strong className="text-[var(--ink)]">
                      {r.result.total} / {r.result.outOf}
                    </strong>{" "}
                    ·{" "}
                    {Object.entries(r.result.sections)
                      .map(
                        ([s, v]) =>
                          `${sectionLabels[s] ?? s} ${v.score}/${v.outOf}`,
                      )
                      .join(" · ")}{" "}
                    · the check suggests level {r.result.suggestedLevel}
                  </div>
                ) : null}

                <a
                  href={`/check/${r.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-sm text-[var(--primary)] hover:underline"
                >
                  Open their page
                </a>
              </li>
            ))}
          </ul>
        )}

        <Button variant="secondary" disabled={pending} onClick={onIssue}>
          Send them the level check
        </Button>

        {issued && (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] p-4">
            <p className="text-sm text-[var(--ink-muted)]">
              Their link — paste it into WhatsApp or an email:
            </p>
            <p className="mt-1 font-mono text-sm break-all">{issued}</p>
            <Button
              variant="secondary"
              className="mt-2"
              onClick={() => {
                navigator.clipboard?.writeText(issued);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        )}
      </section>

      {/* --- what you decided --- */}
      <form onSubmit={onSave} className="max-w-xl space-y-5">
        <Field label="Where they are" htmlFor="status">
          <Select id="status" name="status" defaultValue={enquiry.status}>
            {STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="The check suggested"
            htmlFor="suggestedLevel"
            hint="Leave it. It's only a starting point for the conversation."
          >
            <Input
              id="suggestedLevel"
              name="suggestedLevel"
              type="number"
              min={1}
              max={4}
              defaultValue={enquiry.suggestedLevel ?? ""}
            />
          </Field>
          <Field
            label="Where they'll start"
            htmlFor="startingLevel"
            hint="Your call, after the class. When in doubt, lower."
          >
            <Input
              id="startingLevel"
              name="startingLevel"
              type="number"
              min={1}
              max={4}
              defaultValue={enquiry.startingLevel ?? ""}
            />
          </Field>
        </div>

        <Field
          label="What you saw in the class"
          htmlFor="teacherNotes"
          hint="Speaking, confidence, writing. This is what the report is built from."
        >
          <Textarea
            id="teacherNotes"
            name="teacherNotes"
            defaultValue={enquiry.teacherNotes}
          />
        </Field>

        <Field label="Anything else" htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={enquiry.notes} />
        </Field>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>

        <p className="text-sm text-[var(--ink-faint)]">
          Marking someone “Not this time” starts the twelve-month clock — their
          details are deleted after that, as promised on the form.
        </p>
      </form>
    </div>
  );
}
