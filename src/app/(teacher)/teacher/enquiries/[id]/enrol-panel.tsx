"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Select, Textarea } from "@/components/ui/field";
import { AVATARS, AVATAR_KEYS } from "@/lib/avatars";

import { enrolFromEnquiry } from "../actions";

/**
 * Turning this enquiry into a learning child, without leaving the page.
 *
 * Everything the account needs is already on screen — the parent's name,
 * their address, their timezone, the child's name — so the form asks only for
 * what genuinely is not known yet: how old they are, which avatar, and how
 * consent was obtained.
 */
export function EnrolPanel({
  enquiryId,
  childFirstName,
  childAgeBand,
  parentEmail,
  parentName,
}: {
  enquiryId: string;
  childFirstName: string | null;
  childAgeBand: string | null;
  parentEmail: string;
  parentName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    childId: string;
    password: string | null;
  } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await enrolFromEnquiry(enquiryId, new FormData(e.currentTarget));
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone({ childId: res.childId, password: res.parentPassword });
    router.refresh();
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-card)] bg-[var(--panel-mint)] px-5 py-5">
        <p className="font-medium">Enrolled.</p>
        {done.password ? (
          <>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              A new account for {parentEmail}. This password is shown once —
              send it to them however you normally talk, and never by email.
            </p>
            <p className="mt-3 rounded-[var(--radius)] bg-[var(--surface)] px-4 py-3 font-mono text-lg">
              {done.password}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {parentEmail} already had an account, so their password is
            unchanged and this child was added to it.
          </p>
        )}
        <Button asChild className="mt-4">
          <Link href={`/teacher/students/${done.childId}`}>
            Put them on a syllabus
          </Link>
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Ready to start?</p>
            <p className="text-sm text-[var(--ink-muted)]">
              Makes the parent account and {childFirstName ?? "the child"}
              &rsquo;s profile from what is already here.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>Enrol</Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-[var(--radius-card)] bg-[var(--panel-lilac)] px-5 py-5"
    >
      <div>
        <p className="font-medium">Enrol {childFirstName ?? "this child"}</p>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          The account goes to {parentName ? `${parentName}, ` : ""}
          {parentEmail}.
        </p>
      </div>

      {error ? <Notice>{error}</Notice> : null}

      <Field label="Child's first name" htmlFor="childFirstName">
        <Input
          id="childFirstName"
          name="childFirstName"
          required
          defaultValue={childFirstName ?? ""}
        />
      </Field>

      <Field label="Age" htmlFor="childAgeBand">
        <Select
          id="childAgeBand"
          name="childAgeBand"
          defaultValue={childAgeBand ?? "8_9"}
        >
          <option value="8_9">8&ndash;9</option>
          <option value="10_11">10&ndash;11</option>
          <option value="any">Not sure yet</option>
        </Select>
      </Field>

      <Field label="Avatar" htmlFor="avatar" hint="They can change it later.">
        <Select id="avatar" name="avatar" defaultValue="fox">
          {AVATAR_KEYS.map((k) => (
            <option key={k} value={k}>
              {/* A template literal, because JSX collapses the whitespace
                  between two expressions and the emoji ends up glued to the
                  word. */}
              {`${AVATARS[k].emoji}  ${AVATARS[k].label}`}
            </option>
          ))}
        </Select>
      </Field>

      {/*
        Consent is a legal record, not a tickbox.
        Accounts are made by the teacher rather than by the parent, so what
        can honestly be recorded is HOW she obtained it. A checkbox saying
        "the parent agreed" would imply a ceremony that never happened.
      */}
      <Field
        label="How did they agree?"
        htmlFor="consentNote"
        hint="Where and when the parent agreed to us holding their child's data. Left blank means not recorded."
      >
        <Textarea
          id="consentNote"
          name="consentNote"
          placeholder="e.g. Confirmed on WhatsApp, 14 Dec, after reading the privacy note."
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Enrolling…" : "Enrol"}
        </Button>
        <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
