import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  AGE_BANDS,
  CONTENT_GROUPS,
  CONTENT_TYPES,
  contentTypesInGroup,
  type ContentTypeKey,
  LEVELS,
} from "@/lib/content-types";

import { listContent } from "./actions";

export const metadata: Metadata = { title: "Content" };

function StatusPill({ status }: { status: "draft" | "published" }) {
  const published = status === "published";
  return (
    <span
      className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-medium ${
        published
          ? "bg-[var(--correct-soft)] text-[var(--correct)]"
          : "bg-[var(--surface-sunken)] text-[var(--ink-muted)]"
      }`}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

export default async function ContentPage({ searchParams }: PageProps<"/teacher/content">) {
  const sp = await searchParams;
  const filters = {
    q: typeof sp.q === "string" ? sp.q : undefined,
    type: typeof sp.type === "string" ? sp.type : undefined,
    level: typeof sp.level === "string" ? sp.level : undefined,
    status: typeof sp.status === "string" ? sp.status : undefined,
  };

  const items = await listContent(filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Content</h1>
          <p className="text-[var(--ink-muted)]">
            Everything you write lives here. Items are reusable — one passage can
            appear in any week, at any level.
          </p>
        </div>
        <Button asChild>
          <Link href="/teacher/content/new">Add something new</Link>
        </Button>
      </div>

      <form className="flex flex-wrap gap-2" action="/teacher/content">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Search by title"
          className="min-h-10 min-w-48 flex-1 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
        />
        <select
          name="type"
          defaultValue={filters.type ?? ""}
          className="min-h-10 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
        >
          <option value="">Any kind</option>
          {CONTENT_GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {contentTypesInGroup(group).map((key) => (
                <option key={key} value={key}>
                  {CONTENT_TYPES[key].label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          name="level"
          defaultValue={filters.level ?? ""}
          className="min-h-10 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
        >
          <option value="">Any level</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              Level {l}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={filters.status ?? ""}
          className="min-h-10 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
        >
          <option value="">Draft and published</option>
          <option value="draft">Drafts only</option>
          <option value="published">Published only</option>
        </select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-12 text-center">
          <p className="font-medium">Nothing here yet.</p>
          <p className="mt-1 text-[var(--ink-muted)]">
            Start with a word list or a passage — those are the two things every
            week needs.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-sunken)] text-left text-[var(--ink-muted)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Kind</th>
                <th className="px-4 py-2.5 font-medium">Level</th>
                <th className="px-4 py-2.5 font-medium">Age</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-sunken)]"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/teacher/content/${item.id}`}
                      className="font-medium text-[var(--primary)] hover:underline"
                    >
                      {item.title}
                    </Link>
                    {item.themeTags.length > 0 && (
                      <span className="ml-2 text-[var(--ink-faint)]">
                        {item.themeTags.join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--ink-muted)]">
                    {CONTENT_TYPES[item.type as ContentTypeKey]?.label ??
                      item.type}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--ink-muted)]">
                    {item.difficultyLevel}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--ink-muted)]">
                    {AGE_BANDS[item.ageBand]}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-[var(--ink-faint)]">
        {items.length} item{items.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
