"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { searchLibrary } from "@/app/(teacher)/teacher/syllabus/actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import {
  CONTENT_GROUPS,
  CONTENT_TYPES,
  contentTypesInGroup,
  type ContentTypeKey,
} from "@/lib/content-types";

type LibraryRow = Awaited<ReturnType<typeof searchLibrary>>[number];

/**
 * Picks something out of the library and hands back its id.
 *
 * `group` narrows the type dropdown — a class wants class materials, the
 * practice list wants app practice — but neither is enforced. Someone will
 * eventually want a passage in the practice list, and refusing that would be
 * the tool telling the teacher how to teach.
 */
export function ContentPicker({
  group,
  tags,
  onPick,
  onCancel,
  busy,
}: {
  group: (typeof CONTENT_GROUPS)[number];
  /** Tags already in use, for the filter. */
  tags: string[];
  onPick: (contentItemId: string) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [tag, setTag] = useState("");
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(async () => {
        setRows(
          await searchLibrary({
            q: q.trim() || undefined,
            type: type || undefined,
            tag: tag || undefined,
          }),
        );
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [q, type, tag]);

  const suggested = contentTypesInGroup(group);

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--surface-sunken)] p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Input
          value={q}
          autoFocus
          placeholder="Search what you've written…"
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Any kind</option>
          <optgroup label={group}>
            {suggested.map((k) => (
              <option key={k} value={k}>
                {CONTENT_TYPES[k].label}
              </option>
            ))}
          </optgroup>
          {CONTENT_GROUPS.filter((g) => g !== group).map((g) => (
            <optgroup key={g} label={g}>
              {contentTypesInGroup(g).map((k) => (
                <option key={k} value={k}>
                  {CONTENT_TYPES[k].label}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </div>

      {tags.length > 0 && (
        <Select value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">Any tag</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      )}

      {rows.length === 0 ? (
        <p className="py-3 text-sm text-[var(--ink-muted)]">
          {loading ? (
            "Looking…"
          ) : (
            <>
              Nothing here yet.{" "}
              <Link
                href="/teacher/content/new"
                className="underline underline-offset-2"
              >
                Write something
              </Link>{" "}
              and it will show up.
            </>
          )}
        </p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPick(r.id)}
                className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-left hover:bg-[var(--surface)] disabled:opacity-50"
              >
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                <span className="shrink-0 text-sm text-[var(--ink-faint)]">
                  {CONTENT_TYPES[r.type as ContentTypeKey]?.label ?? r.type}
                  {r.status === "draft" ? " · draft" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button variant="quiet" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
