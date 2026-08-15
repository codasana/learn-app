"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Select } from "@/components/ui/field";
import { AVATAR_KEYS, AVATARS } from "@/lib/avatars";
import { AGE_BANDS } from "@/lib/content-types";

import { createFamily } from "./actions";

/** The zones these families actually live in. Not a list of 400. */
const TIMEZONES = [
  ["Asia/Kolkata", "India"],
  ["Asia/Dubai", "UAE / Gulf"],
  ["Asia/Singapore", "Singapore"],
  ["Asia/Riyadh", "Saudi Arabia"],
  ["Europe/London", "UK"],
  ["America/New_York", "US East"],
  ["America/Los_Angeles", "US West"],
  ["Australia/Sydney", "Australia"],
] as const;

export function NewFamily({
  hasAny,
  canEnrol,
}: {
  hasAny: boolean;
  canEnrol: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!hasAny);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [avatar, setAvatar] = useState("fox");
  const [created, setCreated] = useState<{
    childId: string;
    password: string | null;
  } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setPending(true);

    const formData = new FormData(e.currentTarget);
    formData.set("avatar", avatar);

    const result = await createFamily(formData);
    setPending(false);

    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setCreated({ childId: result.childId, password: result.parentPassword });
    router.refresh();
  }

  /* ---------------------------------------------------------------- */

  if (created) {
    return (
      <div className="max-w-xl space-y-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="font-medium">Family added.</p>

        {created.password ? (
          <>
            <p className="text-[var(--ink-muted)]">
              Their first password is below. It is shown once and never sent by
              email — pass it on however you already talk to them, and ask them
              to change it when they sign in.
            </p>
            <p className="rounded-[var(--radius)] bg-[var(--surface-sunken)] px-4 py-3 font-mono text-lg">
              {created.password}
            </p>
          </>
        ) : (
          <p className="text-[var(--ink-muted)]">
            That parent already had an account, so their password is unchanged.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/teacher/students/${created.childId}`}>
              {canEnrol ? "Put them on a syllabus" : "Open their page"}
            </Link>
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setCreated(null);
              setOpen(false);
            }}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add a family
      </Button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-xl space-y-5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <div>
        <h2 className="font-medium">Add a family</h2>
        <p className="text-sm text-[var(--ink-muted)]">
          The parent&rsquo;s account holds the billing and the reports. Add
          their first child here; brothers and sisters can be added afterwards.
        </p>
      </div>

      {message ? <Notice>{message}</Notice> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Parent's name" htmlFor="parentName">
          <Input id="parentName" name="parentName" required autoFocus />
        </Field>
        <Field label="Parent's email" htmlFor="parentEmail">
          <Input id="parentEmail" name="parentEmail" type="email" required />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="WhatsApp" htmlFor="whatsapp" hint="Optional.">
          <Input id="whatsapp" name="whatsapp" />
        </Field>
        <Field
          label="Where they are"
          htmlFor="timezone"
          hint="Every class time and reminder is shown in this zone."
        >
          <Select id="timezone" name="timezone" defaultValue="Asia/Kolkata">
            {TIMEZONES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Child's first name"
          htmlFor="childFirstName"
          hint="First name only — no surname is ever stored."
        >
          <Input id="childFirstName" name="childFirstName" required />
        </Field>
        <Field label="Age" htmlFor="childAgeBand">
          <Select id="childAgeBand" name="childAgeBand" defaultValue="8_9">
            {Object.entries(AGE_BANDS)
              .filter(([value]) => value !== "any")
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </Select>
        </Field>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Their avatar</legend>
        <p className="text-sm text-[var(--ink-muted)]">
          They can change it later. We never store a photo of a child.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {AVATAR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={avatar === key}
              aria-label={AVATARS[key].label}
              onClick={() => setAvatar(key)}
              className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl transition-colors ${
                avatar === key
                  ? "bg-[var(--primary-soft)] ring-2 ring-[var(--primary)]"
                  : "bg-[var(--surface-sunken)] hover:bg-[var(--primary-soft)]"
              }`}
            >
              <span aria-hidden="true">{AVATARS[key].emoji}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add the family"}
        </Button>
        {hasAny && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
