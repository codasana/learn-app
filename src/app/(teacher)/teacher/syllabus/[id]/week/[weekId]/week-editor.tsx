"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ContentPicker } from "@/components/content/content-picker";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Select, Textarea } from "@/components/ui/field";
import {
  AUDIENCES,
  CONTENT_TYPES,
  type ContentTypeKey,
  RELEASE_RULES,
} from "@/lib/content-types";

import {
  addClassMaterial,
  addWeekItem,
  moveClassMaterial,
  moveWeekItem,
  removeClassMaterial,
  removeWeekItem,
  updateClassMaterial,
  updateClassSession,
  updateWeek,
} from "../../../actions";

type Material = {
  id: string;
  release: "before" | "during" | "after" | "never";
  audienceOverride: "student" | "teacher" | "parent" | null;
  contentId: string;
  title: string;
  type: string;
  audience: "student" | "teacher" | "parent";
  status: "draft" | "published";
};

type PracticeItem = {
  id: string;
  contentId: string;
  title: string;
  type: string;
  audience: "student" | "teacher" | "parent";
  status: "draft" | "published";
};

type Session = {
  id: string;
  classNumber: number;
  title: string;
  planMd: string;
  materials: Material[];
};

export function WeekEditor({
  tags,
  week,
  sessions,
  practice,
}: {
  tags: string[];
  week: { id: string; weekNumber: number; theme: string; grammarFocus: string };
  sessions: Session[];
  practice: PracticeItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string } | void>) {
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok && result.error) setMessage(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {message ? <Notice>{message}</Notice> : null}

      <WeekHeader week={week} pending={pending} run={run} />

      {sessions.map((s) => (
        <ClassCard
          key={s.id}
          session={s}
          tags={tags}
          pending={pending}
          run={run}
        />
      ))}

      <Practice
        weekId={week.id}
        tags={tags}
        items={practice}
        pending={pending}
        run={run}
      />
    </div>
  );
}

type Run = (
  fn: () => Promise<{ ok: boolean; error?: string } | void>,
) => void;

/* ------------------------------------------------------------------ */

function WeekHeader({
  week,
  pending,
  run,
}: {
  week: { id: string; theme: string; grammarFocus: string };
  pending: boolean;
  run: Run;
}) {
  const [theme, setTheme] = useState(week.theme);
  const [grammar, setGrammar] = useState(week.grammarFocus);

  const dirty = theme !== week.theme || grammar !== week.grammarFocus;

  return (
    <section className="space-y-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Theme" htmlFor="theme" hint="What this week is about.">
          <Input
            id="theme"
            value={theme}
            placeholder="My family"
            onChange={(e) => setTheme(e.target.value)}
          />
        </Field>
        <Field
          label="Grammar focus"
          htmlFor="grammar"
          hint="Optional. Leave it empty if the week has none."
        >
          <Input
            id="grammar"
            value={grammar}
            placeholder="Simple present"
            onChange={(e) => setGrammar(e.target.value)}
          />
        </Field>
      </div>

      {dirty && (
        <Button
          disabled={pending}
          onClick={() =>
            run(() =>
              updateWeek(week.id, { theme, grammarFocus: grammar }),
            )
          }
        >
          {pending ? "Saving…" : "Save the week"}
        </Button>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ClassCard({
  session,
  tags,
  pending,
  run,
}: {
  session: Session;
  tags: string[];
  pending: boolean;
  run: Run;
}) {
  const [title, setTitle] = useState(session.title);
  const [plan, setPlan] = useState(session.planMd);
  const [picking, setPicking] = useState(false);

  const dirty = title !== session.title || plan !== session.planMd;

  return (
    <section className="space-y-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-baseline gap-3">
        <span className="text-sm text-[var(--ink-faint)]">
          Class {session.classNumber}
        </span>
        <span className="text-sm text-[var(--ink-faint)]">
          {session.classNumber === 1
            ? "usually the new material"
            : "usually the practice and speaking"}
        </span>
      </div>

      <Field label="What you'll call it" htmlFor={`title-${session.id}`}>
        <Input
          id={`title-${session.id}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>

      <div className="space-y-3">
        <p className="text-sm font-medium">In this class</p>

        {session.materials.length === 0 && !picking && (
          <p className="text-sm text-[var(--ink-muted)]">
            Nothing added yet. Slides, a passage, a worksheet — as many as you
            want, in the order you&rsquo;ll use them.
          </p>
        )}

        <ul className="space-y-2">
          {session.materials.map((m, i) => (
            <li
              key={m.id}
              className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/teacher/content/${m.contentId}`}
                    className="truncate font-medium underline-offset-2 hover:underline"
                  >
                    {m.title}
                  </Link>
                  <span className="ml-2 text-sm text-[var(--ink-faint)]">
                    {CONTENT_TYPES[m.type as ContentTypeKey]?.label ?? m.type}
                    {m.status === "draft" ? " · draft" : ""}
                  </span>
                </span>
                <RowButtons
                  index={i}
                  total={session.materials.length}
                  pending={pending}
                  onUp={() => run(() => moveClassMaterial(m.id, "up"))}
                  onDown={() => run(() => moveClassMaterial(m.id, "down"))}
                  onRemove={() => run(() => removeClassMaterial(m.id))}
                />
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-sm text-[var(--ink-muted)]">
                  When the child sees it
                  <Select
                    className="mt-1"
                    value={m.release}
                    disabled={pending}
                    onChange={(e) =>
                      run(() =>
                        updateClassMaterial(m.id, {
                          release: e.target
                            .value as Material["release"],
                          audienceOverride: m.audienceOverride ?? "",
                        }),
                      )
                    }
                  >
                    {Object.entries(RELEASE_RULES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="text-sm text-[var(--ink-muted)]">
                  Who it&rsquo;s for
                  <Select
                    className="mt-1"
                    value={m.audienceOverride ?? ""}
                    disabled={pending}
                    onChange={(e) =>
                      run(() =>
                        updateClassMaterial(m.id, {
                          release: m.release,
                          audienceOverride: e.target
                            .value as "" | "student" | "teacher" | "parent",
                        }),
                      )
                    }
                  >
                    <option value="">
                      As written ({AUDIENCES[m.audience]})
                    </option>
                    {Object.entries(AUDIENCES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            </li>
          ))}
        </ul>

        {picking ? (
          <ContentPicker
            group="Class material"
            tags={tags}
            busy={pending}
            onCancel={() => setPicking(false)}
            onPick={(contentItemId) => {
              setPicking(false);
              run(() => addClassMaterial(session.id, contentItemId));
            }}
          />
        ) : (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => setPicking(true)}
          >
            Add something to this class
          </Button>
        )}
      </div>

      <Field
        label="Your notes for the class"
        htmlFor={`plan-${session.id}`}
        hint="Only you ever see this."
      >
        <Textarea
          id={`plan-${session.id}`}
          value={plan}
          placeholder="Start with the picture. Ask three questions before reading."
          onChange={(e) => setPlan(e.target.value)}
        />
      </Field>

      {dirty && (
        <Button
          disabled={pending}
          onClick={() =>
            run(() => updateClassSession(session.id, { title, planMd: plan }))
          }
        >
          {pending ? "Saving…" : "Save this class"}
        </Button>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Practice({
  weekId,
  tags,
  items,
  pending,
  run,
}: {
  weekId: string;
  tags: string[];
  items: PracticeItem[];
  pending: boolean;
  run: Run;
}) {
  const [picking, setPicking] = useState(false);

  return (
    <section className="space-y-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div>
        <p className="font-medium">On their own, in the app</p>
        <p className="text-sm text-[var(--ink-muted)]">
          What the child practises between the two classes. Ten minutes a day is
          the aim, so three or four things is usually plenty.
        </p>
      </div>

      {items.length === 0 && !picking && (
        <p className="text-sm text-[var(--ink-muted)]">
          Nothing added yet. A word list is the usual starting point.
        </p>
      )}

      <ul className="space-y-2">
        {items.map((it, i) => (
          <li
            key={it.id}
            className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2"
          >
            <span className="min-w-0 flex-1">
              <Link
                href={`/teacher/content/${it.contentId}`}
                className="truncate font-medium underline-offset-2 hover:underline"
              >
                {it.title}
              </Link>
              <span className="ml-2 text-sm text-[var(--ink-faint)]">
                {CONTENT_TYPES[it.type as ContentTypeKey]?.label ?? it.type}
                {it.status === "draft" ? " · draft" : ""}
              </span>
            </span>
            <RowButtons
              index={i}
              total={items.length}
              pending={pending}
              onUp={() => run(() => moveWeekItem(it.id, "up"))}
              onDown={() => run(() => moveWeekItem(it.id, "down"))}
              onRemove={() => run(() => removeWeekItem(it.id))}
            />
          </li>
        ))}
      </ul>

      {picking ? (
        <ContentPicker
          group="App practice"
          tags={tags}
          busy={pending}
          onCancel={() => setPicking(false)}
          onPick={(contentItemId) => {
            setPicking(false);
            run(() => addWeekItem(weekId, contentItemId));
          }}
        />
      ) : (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => setPicking(true)}
        >
          Add practice
        </Button>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function RowButtons({
  index,
  total,
  pending,
  onUp,
  onDown,
  onRemove,
}: {
  index: number;
  total: number;
  pending: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const base =
    "flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-30";

  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label="Move up"
        className={base}
        disabled={pending || index === 0}
        onClick={onUp}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label="Move down"
        className={base}
        disabled={pending || index === total - 1}
        onClick={onDown}
      >
        ↓
      </button>
      <button
        type="button"
        aria-label="Take out"
        title="Take out of this week"
        className={base}
        disabled={pending}
        onClick={onRemove}
      >
        ×
      </button>
    </span>
  );
}
