import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { contentItems } from "@/db/schema";
import { requireTeacher } from "@/lib/session";

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
          difficultyLevel: item.difficultyLevel,
          ageBand: item.ageBand,
          audience: item.audience,
          status: item.status,
          themeTags: item.themeTags,
          grammarTags: item.grammarTags,
          body: item.body,
        }}
      />
    </div>
  );
}
