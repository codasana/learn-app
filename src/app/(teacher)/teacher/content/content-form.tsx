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
  LEVEL_NAMES,
  LEVELS,
} from "@/lib/content-types";

import { saveContentItem } from "./actions";

export type ContentDraft = {
  id: string | null;
  title: string;
  type: string;
  difficultyLevel: number;
  ageBand: "any" | "8_9" | "10_11";
  audience: "student" | "teacher" | "parent";
  status: "draft" | "published";
  themeTags: string[];
  grammarTags: string[];
  body: unknown;
};

export function ContentForm({ item }: { item: ContentDraft }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Type and body are controlled together: switching the type re-parses the
  // body so the new editor always gets a shape it understands.
  const [type, setType] = useState(item.type);
  const [body, setBody] = useState<Record<string, unknown>>(
    () => parseBody(item.type, item.body) as Record<string, unknown>,
  );

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

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Level"
          htmlFor="difficultyLevel"
          hint="How hard the English is."
        >
          <Select
            id="difficultyLevel"
            name="difficultyLevel"
            defaultValue={String(item.difficultyLevel)}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_NAMES[l]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Age"
          htmlFor="ageBand"
          hint="How grown-up the topic is. Separate from level."
        >
          <Select id="ageBand" name="ageBand" defaultValue={item.ageBand}>
            {Object.entries(AGE_BANDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

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

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Themes"
          htmlFor="themeTags"
          hint="Comma separated, e.g. family, routine"
        >
          <Input
            id="themeTags"
            name="themeTags"
            defaultValue={item.themeTags.join(", ")}
          />
        </Field>
        <Field
          label="Grammar"
          htmlFor="grammarTags"
          hint="Comma separated, e.g. simple present"
        >
          <Input
            id="grammarTags"
            name="grammarTags"
            defaultValue={item.grammarTags.join(", ")}
          />
        </Field>
      </div>

      <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
        <BodyEditor type={type} value={body} onChange={setBody} />
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
