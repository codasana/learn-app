import { count, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/db";
import {
  enquiries,
  childProfiles,
  contentItems,
  enrollments,

  syllabi,
  submissions,
} from "@/db/schema";
import { requireTeacher } from "@/lib/session";

import { needsAttention } from "./attention-actions";
import { Today } from "./today";
import { classesOn } from "./today-actions";

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
  const [openEnquiries] = await db
    .select({ n: count() })
    .from(enquiries)
    .where(sql`${enquiries.status} not in ('enrolled','declined','dormant')`);
  const [awaiting] = await db
    .select({ n: count() })
    .from(submissions)
    .where(sql`${submissions.status} in ('submitted','ai_drafted')`);
  return {
    items: items.n,
    published: published.n,
    syllabi: syllabusCount.n,
    children: children.n,
    active: active.n,
    awaiting: awaiting.n,
    openLeads: openEnquiries.n,
  };
}

export default async function TeacherHome() {
  const user = await requireTeacher();
  const today = await classesOn();
  const attention = await needsAttention();
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

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-wide text-[var(--ink-faint)] uppercase">
          Today
        </h2>
        <Today classes={today.classes} timezone={today.timezone} />
      </section>

      {c.awaiting > 0 && (
        <Link
          href="/teacher/review"
          className="block rounded-[var(--radius-card)] bg-[var(--accent-soft)] px-4 py-3 text-[var(--accent-ink)]"
        >
          <span className="font-medium">
            {c.awaiting} thing{c.awaiting === 1 ? "" : "s"} waiting for you to
            look at
          </span>{" "}
          — children see nothing until you release it.
        </Link>
      )}

      {attention.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-wide text-[var(--ink-faint)] uppercase">
            Worth a look
          </h2>
          <ul className="space-y-2">
            {attention.map((a, i) => (
              <li key={`${a.kind}-${i}`}>
                <Link
                  href={a.href}
                  className="flex flex-wrap items-baseline gap-x-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition-colors hover:border-[var(--border-strong)]"
                >
                  <span className="font-medium">{a.title}</span>
                  <span className="text-sm text-[var(--ink-faint)]">
                    {a.detail}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.items === 0 && (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-8">
          <p className="font-medium">Nothing written yet.</p>
          <p className="mt-1 text-[var(--ink-muted)]">
            A good first step is a word list — every unit needs one, and it takes
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
