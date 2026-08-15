"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Select } from "@/components/ui/field";
import { suggestUsername } from "@/lib/username-suggestion";

import {
  createLogin,
  enrolChild,
  resetLogin,
  suggestPassword,
  updateEnrolment,
} from "../actions";

type Enrolment = {
  id: string;
  status: "active" | "paused" | "completed" | "withdrawn";
  currentUnit: number;
  startDate: string;
  syllabusId: string;
  syllabusName: string;
  /** The word this syllabus uses. Never hardcode "Week" in this file. */
  unitLabel: string;
};

const STATUS_LABELS: Record<string, string> = {
  active: "Learning",
  paused: "Paused",
  completed: "Finished",
  withdrawn: "Left",
};

export function StudentEditor({
  childId,
  firstName,
  activeEnrolmentId,
  history,
  syllabuses,
  signIn,
}: {
  childId: string;
  firstName: string;
  activeEnrolmentId: string | null;
  history: Enrolment[];
  syllabuses: { id: string; name: string }[];
  signIn: { username: string } | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const active = history.find((h) => h.id === activeEnrolmentId) ?? null;

  return (
    <div className="space-y-8">
      {message ? <Notice>{message}</Notice> : null}

      <Enrolment
        childId={childId}
        firstName={firstName}
        active={active}
        history={history}
        syllabuses={syllabuses}
        pending={pending}
        setPending={setPending}
        setMessage={setMessage}
        refresh={() => router.refresh()}
      />

      <SignIn
        childId={childId}
        firstName={firstName}
        signIn={signIn}
        pending={pending}
        setPending={setPending}
        setMessage={setMessage}
        refresh={() => router.refresh()}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

type Shared = {
  pending: boolean;
  setPending: (v: boolean) => void;
  setMessage: (v: string | null) => void;
  refresh: () => void;
};

function Enrolment({
  childId,
  firstName,
  active,
  history,
  syllabuses,
  pending,
  setPending,
  setMessage,
  refresh,
}: Shared & {
  childId: string;
  firstName: string;
  active: Enrolment | null;
  history: Enrolment[];
  syllabuses: { id: string; name: string }[];
}) {
  const [chosen, setChosen] = useState(syllabuses[0]?.id ?? "");
  const word = (active?.unitLabel ?? "Unit").toLowerCase();

  async function onEnrol() {
    if (!chosen) return;
    setPending(true);
    setMessage(null);
    const res = await enrolChild(childId, chosen);
    setPending(false);
    if (!res.ok) setMessage(res.error);
    refresh();
  }

  async function onUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!active) return;
    setPending(true);
    setMessage(null);
    const res = await updateEnrolment(active.id, new FormData(e.currentTarget));
    setPending(false);
    if (!res.ok) setMessage(res.error);
    refresh();
  }

  const past = history.filter((h) => h.id !== active?.id);

  return (
    <section className="space-y-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-medium">What they&rsquo;re learning</h2>

      {syllabuses.length === 0 ? (
        <p className="text-[var(--ink-muted)]">
          No published syllabus to put anyone on yet. Publish one and it will
          appear here.
        </p>
      ) : active ? (
        <form onSubmit={onUpdate} className="space-y-4">
          <p className="text-lg font-medium">{active.syllabusName}</p>
          <p className="text-sm text-[var(--ink-faint)]">
            Started {active.startDate}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={`Which ${word} they're on`}
              htmlFor="currentUnit"
              hint={`Move this on when they finish a ${word}.`}
            >
              <Input
                id="currentUnit"
                name="currentUnit"
                type="number"
                min={1}
                max={52}
                defaultValue={active.currentUnit}
              />
            </Field>
            <Field label="How it's going" htmlFor="status">
              <Select id="status" name="status" defaultValue={active.status}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-[var(--ink-muted)]">
              Move {firstName} to a different syllabus
            </summary>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <Select
                className="max-w-xs"
                value={chosen}
                onChange={(e) => setChosen(e.target.value)}
              >
                {syllabuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={onEnrol}
              >
                Move them
              </Button>
            </div>
            <p className="mt-2 text-[var(--ink-muted)]">
              The current one is marked finished rather than deleted. Their
              vocabulary memory keys on the word, not the unit, so nothing they
              have learned is lost by moving.
            </p>
          </details>
        </form>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Put them on" htmlFor="syllabus">
            <Select
              id="syllabus"
              className="max-w-xs"
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
            >
              {syllabuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button disabled={pending} onClick={onEnrol}>
            {pending ? "Starting…" : "Start them"}
          </Button>
        </div>
      )}

      {past.length > 0 && (
        <div className="border-t border-[var(--border)] pt-4">
          <p className="text-sm font-medium text-[var(--ink-muted)]">Before</p>
          <ul className="mt-2 space-y-1 text-sm text-[var(--ink-faint)]">
            {past.map((h) => (
              <li key={h.id}>
                {h.syllabusName} · {STATUS_LABELS[h.status]} · from{" "}
                {h.startDate}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function SignIn({
  childId,
  firstName,
  signIn,
  pending,
  setPending,
  setMessage,
  refresh,
}: Shared & {
  childId: string;
  firstName: string;
  signIn: { username: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(() => suggestUsername(firstName));
  const [password, setPassword] = useState("");
  const [issued, setIssued] = useState<{
    username?: string;
    password: string;
  } | null>(null);

  async function fillPassword() {
    setPassword(await suggestPassword());
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const res = await createLogin(childId, new FormData(e.currentTarget));
    setPending(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    setIssued({ username: res.username, password: res.password });
    setOpen(false);
    refresh();
  }

  async function onReset() {
    setPending(true);
    setMessage(null);
    const fresh = await suggestPassword();
    const res = await resetLogin(childId, fresh);
    setPending(false);
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    setIssued({ password: res.password });
    refresh();
  }

  return (
    <section className="space-y-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div>
        <h2 className="font-medium">{firstName}&rsquo;s own sign-in</h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Optional. {firstName} can always get in through the parent&rsquo;s
          account, but most children this age have their own tablet and prefer
          their own login. No email is needed, and we would rather not have one.
        </p>
      </div>

      {issued && (
        <div className="space-y-2 rounded-[var(--radius)] bg-[var(--correct-soft)] px-4 py-3">
          <p className="font-medium text-[var(--correct)]">
            {issued.username ? "Sign-in created." : "Password changed."}
          </p>
          {issued.username && (
            <p className="font-mono text-lg">{issued.username}</p>
          )}
          <p className="font-mono text-lg">{issued.password}</p>
          <p className="text-sm text-[var(--ink-muted)]">
            Shown once. Pass it to the parent — it is never emailed.
          </p>
        </div>
      )}

      {signIn ? (
        <div className="flex flex-wrap items-center gap-4">
          <p>
            Signs in as{" "}
            <span className="font-mono font-medium">{signIn.username}</span>
          </p>
          <Button variant="secondary" disabled={pending} onClick={onReset}>
            {pending ? "Working…" : "Give them a new password"}
          </Button>
        </div>
      ) : open ? (
        <form onSubmit={onCreate} className="max-w-md space-y-4">
          <Field
            label="Username"
            htmlFor="username"
            hint="Not identifying — a first name and a number, never a surname."
          >
            <Input
              id="username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            hint="Two words and a number is far easier for a child to type than a jumble."
          >
            <div className="flex gap-2">
              <Input
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <Button type="button" variant="secondary" onClick={fillPassword}>
                Suggest
              </Button>
            </div>
          </Field>

          <div className="flex gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create the sign-in"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setOpen(true);
            void fillPassword();
          }}
        >
          Give {firstName} a sign-in
        </Button>
      )}
    </section>
  );
}
