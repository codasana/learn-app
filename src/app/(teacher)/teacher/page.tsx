import { count, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/db";
import {
  childProfiles,
  contentItems,
  enrollments,
  leads,
  syllabi,
  writingSubmissions,
} from "@/db/schema";
import { requireTeacher } from "@/lib/session";

export const metadata: Metadata = { title: "Home" };

async function counts() {
  const [items] = await db.select({ n: count() }).from(contentItems);
  const [published] = await db
    .select({ n: count() })
    .from(contentItems)
    .where(eq(contentItems.status, "published"));
  const [syllabusCount] = await db.select({ n: count() }).from(syllabi);
  const [children] = await db.select({ n: count() }).from(childProfiles);
  const [active] = await db
    .select({ n: count() })
    .from(enrollments)
    .where(eq(enrollments.status, "active"));
  const [awaiting] = await db
    .select({ n: count() })
    .from(writingSubmissions)
    .where(sql`${writingSubmissions.status} in ('submitted','ai_drafted')`);
  const [openLeads] = await db
    .select({ n: count() })
    .from(leads)
    .where(sql`${leads.status} not in ('enrolled','declined','dormant')`);

  return {
    items: items.n,
    published: published.n,
    syllabi: syllabusCount.n,
    children: children.n,
    active: active.n,
    awaiting: awaiting.n,
    openLeads: openLeads.n,
  };
}

function Stat({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number;
  href?: string;
  hint?: string;
}) {
  const inner = (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--border-strong)]">
      <p className="text-sm text-[var(--ink-muted)]">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {hint ? (
        <p className="mt-1 text-sm text-[var(--ink-faint)]">{hint}</p>
      ) : null}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function TeacherHome() {
  const user = await requireTeacher();
  const c = await counts();

  const firstName = user.name?.split(/[\s@.]/)[0] ?? "there";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Hello, {firstName}</h1>
        <p className="text-[var(--ink-muted)]">
          Everything you need for this week is here.
        </p>
      </div>

      {c.awaiting > 0 && (
        <Link
          href="/teacher/writing"
          className="block rounded-[var(--radius-card)] bg-[var(--accent-soft)] px-4 py-3 text-[var(--accent-ink)]"
        >
          <span className="font-medium">
            {c.awaiting} piece{c.awaiting === 1 ? "" : "s"} of writing waiting
            for you
          </span>{" "}
          — children see nothing until you release it.
        </Link>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-wide text-[var(--ink-faint)] uppercase">
          Your content
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Things you've written"
            value={c.items}
            href="/teacher/content"
            hint={`${c.published} published`}
          />
          <Stat label="Syllabuses" value={c.syllabi} href="/teacher/syllabus" />
          <Stat
            label="Writing to review"
            value={c.awaiting}
            href="/teacher/writing"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-wide text-[var(--ink-faint)] uppercase">
          Your students
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Children" value={c.children} href="/teacher/students" />
          <Stat label="Currently learning" value={c.active} />
          <Stat label="Families deciding" value={c.openLeads} />
        </div>
      </section>

      {c.items === 0 && (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-8">
          <p className="font-medium">Nothing written yet.</p>
          <p className="mt-1 text-[var(--ink-muted)]">
            A good first step is a word list — every week needs one, and it takes
            a couple of minutes if you already have the words in a document.
          </p>
          <Link
            href="/teacher/content/new"
            className="mt-3 inline-block rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 font-medium text-white"
          >
            Write your first word list
          </Link>
        </div>
      )}
    </div>
  );
}
