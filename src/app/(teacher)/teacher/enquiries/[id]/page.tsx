import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { enquiries } from "@/db/schema";
import { requireTeacher } from "@/lib/session";
import { runsForEnquiry } from "@/lib/tool-runs";
import { levelCheck } from "@/lib/tools";

import { EnquiryEditor } from "./enquiry-editor";

export const metadata: Metadata = { title: "Enquiry" };

export default async function EnquiryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();
  const { id } = await params;

  const enquiry = await db.query.enquiries.findFirst({
    where: eq(enquiries.id, id),
  });
  if (!enquiry) notFound();

  const runs = await runsForEnquiry(id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/teacher/enquiries"
          className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          ← All enquiries
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {enquiry.childFirstName ?? enquiry.parentName ?? "Enquiry"}
        </h1>
        <p className="text-[var(--ink-muted)]">
          {enquiry.parentName ? `${enquiry.parentName} · ` : ""}
          {enquiry.parentEmail ?? "no email"}
          {enquiry.whatsapp ? ` · ${enquiry.whatsapp}` : ""}
        </p>
        <p className="text-sm text-[var(--ink-faint)]">
          {enquiry.source === "tool"
            ? "Came through the free check"
            : "Asked directly"}{" "}
          · {enquiry.createdAt.toLocaleDateString("en-GB")}
        </p>
      </div>

      <EnquiryEditor
        enquiry={{
          id: enquiry.id,
          status: enquiry.status,
          suggestedLevel: enquiry.suggestedLevel,
          startingLevel: enquiry.startingLevel,
          teacherNotes: enquiry.teacherNotes ?? "",
          notes: enquiry.notes ?? "",
        }}
        runs={runs.map((r) => {
          const parsed = levelCheck.resultSchema.safeParse(r.result);
          return {
            id: r.id,
            tool: r.tool,
            token: r.token,
            startedAt: r.startedAt.toISOString(),
            completedAt: r.completedAt?.toISOString() ?? null,
            result: parsed.success ? parsed.data : null,
          };
        })}
        sectionLabels={levelCheck.SECTION_LABELS}
      />
    </div>
  );
}
