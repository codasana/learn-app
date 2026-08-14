import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { contentItems } from "@/db/schema";
import { requireTeacher } from "@/lib/session";

import { allTags } from "../actions";
import { ContentForm } from "../content-form";

export const metadata: Metadata = { title: "Edit content" };

export default async function EditContentPage({
  params,
}: PageProps<"/teacher/content/[id]">) {
  await requireTeacher();
  const { id } = await params;

  const item = await db.query.contentItems.findFirst({
    where: eq(contentItems.id, id),
  });
  if (!item) notFound();

  const tags = await allTags();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{item.title}</h1>
        <p className="text-[var(--ink-muted)]">
          Editing this changes it everywhere it is used.
        </p>
      </div>

      <ContentForm
        item={{
          id: item.id,
          title: item.title,
          type: item.type,
          ageBand: item.ageBand,
          audience: item.audience,
          status: item.status,
          tags: item.tags,
          body: item.body,
          fileUrl: item.fileUrl,
        }}
        knownTags={tags.map((t) => t.tag)}
      />
    </div>
  );
}
