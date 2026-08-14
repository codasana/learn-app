"use server";

import {
  and,
  arrayContains,
  desc,
  eq,
  ilike,
  type SQL,
  sql,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { contentItems } from "@/db/schema";
import { readyToPublish } from "@/lib/content-schemas";
import { CONTENT_TYPE_KEYS } from "@/lib/content-types";
import { requireTeacher } from "@/lib/session";

const itemSchema = z.object({
  title: z.string().trim().min(1, "Give it a title."),
  type: z.enum(CONTENT_TYPE_KEYS as [string, ...string[]]),
  ageBand: z.enum(["any", "8_9", "10_11"]),
  audience: z.enum(["student", "teacher", "parent"]),
  status: z.enum(["draft", "published"]),
  tags: z.string().optional(),
  body: z.string().optional(),
  fileUrl: z.string().optional(),
});

function splitTags(raw?: string) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

export async function listContent(filters: {
  q?: string;
  type?: string;
  tag?: string;
  status?: string;
}) {
  await requireTeacher();

  const where: SQL[] = [];
  if (filters.q) where.push(ilike(contentItems.title, `%${filters.q}%`));
  if (filters.type) {
    where.push(eq(contentItems.type, filters.type as "passage"));
  }
  if (filters.status) {
    where.push(eq(contentItems.status, filters.status as "draft"));
  }

  if (filters.tag) {
    where.push(arrayContains(contentItems.tags, [filters.tag.toLowerCase()]));
  }

  return db
    .select()
    .from(contentItems)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(contentItems.updatedAt))
    .limit(200);
}

/**
 * Every tag in use, most-used first.
 *
 * Feeds the filter dropdown and the suggestions under the tag box. Showing
 * what already exists is what stops a library growing three spellings of the
 * same idea — there is no tag admin screen, and there should not need to be.
 */
export async function allTags(): Promise<{ tag: string; n: number }[]> {
  await requireTeacher();
  const rows = await db.execute<{ tag: string; n: number }>(sql`
    select tag, count(*)::int as n
      from content_items, unnest(tags) as tag
     group by tag
     order by n desc, tag asc
  `);
  return rows.rows.map((r) => ({ tag: r.tag, n: Number(r.n) }));
}

export async function saveContentItem(
  id: string | null,
  formData: FormData,
): Promise<ActionResult> {
  const teacher = await requireTeacher();

  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  // The body arrives already structured from the per-type editor.
  let body: unknown = {};
  if (v.body?.trim()) {
    try {
      body = JSON.parse(v.body);
    } catch {
      return { ok: false, error: "Something went wrong saving the details." };
    }
  }

  // Drafts always save, however incomplete — being unable to save half-finished
  // work is how people stop using a tool. Completeness is checked only when
  // publishing, since that is what children can see.
  if (v.status === "published") {
    const problem = readyToPublish(v.type, body);
    if (problem) return { ok: false, error: problem };
  }

  const values = {
    title: v.title,
    type: v.type as "passage",
    ageBand: v.ageBand,
    audience: v.audience,
    status: v.status,
    tags: splitTags(v.tags),
    body: body as Record<string, unknown>,
    fileUrl: v.fileUrl?.trim() || null,
    updatedAt: new Date(),
  };

  const [row] = id
    ? await db
        .update(contentItems)
        .set(values)
        .where(eq(contentItems.id, id))
        .returning({ id: contentItems.id })
    : await db
        .insert(contentItems)
        .values({ ...values, createdBy: teacher.id })
        .returning({ id: contentItems.id });

  revalidatePath("/teacher/content");
  return { ok: true, id: row.id };
}

export async function setStatus(id: string, status: "draft" | "published") {
  await requireTeacher();
  await db
    .update(contentItems)
    .set({ status, updatedAt: new Date() })
    .where(eq(contentItems.id, id));
  revalidatePath("/teacher/content");
}

/**
 * Duplicating is how an age-band variant gets made: copy the Level 1 passage,
 * retag it 10–11, rewrite the topic. Always lands as a draft.
 */
export async function duplicateItem(id: string): Promise<ActionResult> {
  await requireTeacher();

  const original = await db.query.contentItems.findFirst({
    where: eq(contentItems.id, id),
  });
  if (!original) return { ok: false, error: "That item no longer exists." };

  const { id: _drop, createdAt: _c, updatedAt: _u, ...rest } = original;
  const [row] = await db
    .insert(contentItems)
    .values({ ...rest, title: `${original.title} (copy)`, status: "draft" })
    .returning({ id: contentItems.id });

  revalidatePath("/teacher/content");
  return { ok: true, id: row.id };
}

export async function deleteItem(id: string) {
  await requireTeacher();
  // Restricted FKs mean this fails loudly if the item is used in a syllabus —
  // which is correct. Deleting content out from under a running cohort must not
  // be a one-click accident.
  await db.delete(contentItems).where(eq(contentItems.id, id));
  revalidatePath("/teacher/content");
}
