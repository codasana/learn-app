"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BodyEditor } from "@/components/content/body-editor";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Select } from "@/components/ui/field";
import { parseBody } from "@/lib/content-schemas";
import {
  AGE_BANDS,
  AUDIENCES,
  CONTENT_GROUPS,
  CONTENT_TYPES,
  contentTypesInGroup,
} from "@/lib/content-types";

import { saveContentItem } from "./actions";

export type ContentDraft = {
  id: string | null;
  title: string;
  type: string;
  ageBand: "any" | "8_9" | "10_11";
  audience: "student" | "teacher" | "parent";
  status: "draft" | "published";
  tags: string[];
  body: unknown;
  fileUrl: string | null;
};

export function ContentForm({
  item,
  knownTags,
}: {
  item: ContentDraft;
  knownTags: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Type and body are controlled together: switching the type re-parses the
  // body so the new editor always gets a shape it understands.
  const [type, setType] = useState(item.type);
  const [body, setBody] = useState<Record<string, unknown>>(
    () => parseBody(item.type, item.body) as Record<string, unknown>,
  );
  // Lives on the item rather than in `body`, so a query can find every item
  // with a file without opening the jsonb.
  const [fileUrl, setFileUrl] = useState<string | null>(item.fileUrl);

  // Clicking a suggestion appends it rather than replacing what is typed —
  // tagging is additive, and losing half-typed input to a stray click is the
  // kind of small betrayal that stops people using a field at all.
  function addTag(tag: string) {
    const input = document.getElementById("tags") as HTMLInputElement | null;
    if (!input) return;
    const current = input.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (current.includes(tag)) return;
    input.value = [...current, tag].join(", ");
  }

  function onTypeChange(next: string) {
    setType(next);
    setBody(parseBody(next, body) as Record<string, unknown>);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setPending(true);

    const formData = new FormData(e.currentTarget);
    formData.set("body", JSON.stringify(body));
    formData.set("fileUrl", fileUrl ?? "");

    const result = await saveContentItem(item.id, formData);
    setPending(false);

    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    router.push("/teacher/content");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      {message ? <Notice>{message}</Notice> : null}

      <Field label="Title" htmlFor="title">
        <Input
          id="title"
          name="title"
          defaultValue={item.title}
          required
          autoFocus
          placeholder="Meet Meera"
        />
      </Field>

      <Field label="What kind of thing is it?" htmlFor="type">
        <Select
          id="type"
          name="type"
          value={type}
          onChange={(e) => onTypeChange(e.target.value)}
        >
          {CONTENT_GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {contentTypesInGroup(group).map((key) => (
                <option key={key} value={key}>
                  {CONTENT_TYPES[key].label}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>

      {/*
        There is deliberately no level field. A piece of content takes its
        level from the syllabus that uses it — see lib/content-usage. Asking
        for it here would be asking a question with no answer yet.
      */}
      <Field
        label="Age"
        htmlFor="ageBand"
        hint="How grown-up the topic is — not how hard the English is."
      >
        <Select id="ageBand" name="ageBand" defaultValue={item.ageBand}>
          {Object.entries(AGE_BANDS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Who sees it"
        htmlFor="audience"
        hint="Choose 'Teacher only' for answer keys and activity notes."
      >
        <Select id="audience" name="audience" defaultValue={item.audience}>
          {Object.entries(AUDIENCES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Tags"
        htmlFor="tags"
        hint="Comma separated. Whatever helps you find it again — family, simple present, easy."
      >
        <Input id="tags" name="tags" defaultValue={item.tags.join(", ")} />
        {knownTags.length > 0 && (
          <p className="text-sm text-[var(--ink-faint)]">
            Already in use:{" "}
            {knownTags.slice(0, 12).map((t, i) => (
              <span key={t}>
                {i > 0 ? ", " : ""}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-[var(--ink)]"
                  onClick={() => addTag(t)}
                >
                  {t}
                </button>
              </span>
            ))}
          </p>
        )}
      </Field>

      <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
        <BodyEditor
          type={type}
          value={body}
          onChange={setBody}
          fileUrl={fileUrl}
          onFileChange={setFileUrl}
        />
      </div>

      <Field
        label="Status"
        htmlFor="status"
        hint="Drafts are invisible to children. Publish when you're happy with it."
      >
        <Select id="status" name="status" defaultValue={item.status}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </Select>
      </Field>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/teacher/content")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
