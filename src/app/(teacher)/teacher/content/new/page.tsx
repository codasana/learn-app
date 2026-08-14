import type { Metadata } from "next";

import { requireTeacher } from "@/lib/session";

import { ContentForm } from "../content-form";

export const metadata: Metadata = { title: "New content" };

export default async function NewContentPage() {
  await requireTeacher();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Add something new</h1>
        <p className="text-[var(--ink-muted)]">
          It saves as a draft until you publish it, so nothing reaches a child
          before you are ready.
        </p>
      </div>

      <ContentForm
        item={{
          id: null,
          title: "",
          type: "passage",
          difficultyLevel: 1,
          ageBand: "any",
          audience: "student",
          status: "draft",
          themeTags: [],
          grammarTags: [],
          body: {},
        }}
      />
    </div>
  );
}
