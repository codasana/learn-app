"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Select, Textarea } from "@/components/ui/field";
import { AGE_BANDS } from "@/lib/content-types";

import { createEnquiry } from "./actions";

export function NewEnquiry({ hasAny }: { hasAny: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!hasAny);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setPending(true);

    const result = await createEnquiry(new FormData(e.currentTarget));
    setPending(false);

    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    router.push(`/teacher/enquiries/${result.id}`);
    router.refresh();
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
          For someone who reached you another way — a referral, a message, a
          conversation at school.
        </p>
      </div>

      {message ? <Notice>{message}</Notice> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Parent's name" htmlFor="parentName">
          <Input id="parentName" name="parentName" required autoFocus />
        </Field>
        <Field label="Email" htmlFor="parentEmail">
          <Input id="parentEmail" name="parentEmail" type="email" required />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="WhatsApp" htmlFor="whatsapp">
          <Input id="whatsapp" name="whatsapp" />
        </Field>
        <Field
          label="Child's first name"
          htmlFor="childFirstName"
          hint="First name only."
        >
          <Input id="childFirstName" name="childFirstName" />
        </Field>
        <Field label="Age" htmlFor="childAgeBand">
          <Select id="childAgeBand" name="childAgeBand" defaultValue="any">
            {Object.entries(AGE_BANDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Anything worth remembering" htmlFor="notes">
        <Textarea
          id="notes"
          name="notes"
          placeholder="Referred by Priya. Wants evening slots, Dubai time."
        />
      </Field>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add"}
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
