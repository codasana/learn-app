import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { enquiryWithFamily, siblingsOf } from "@/lib/enquiries";
import { requireTeacher } from "@/lib/session";
import { runsForEnquiry } from "@/lib/tool-runs";
import { levelCheck } from "@/lib/tools";

import { EnquiryEditor } from "./enquiry-editor";
import { EnrolPanel } from "./enrol-panel";

export const metadata: Metadata = { title: "Enquiry" };

/** Mirrors the dropdown in enquiry-editor.tsx. */
const STATUS_LABEL: Record<string, string> = {
  new: "New",
  class_scheduled: "Class booked",
  class_done: "Class done",
  report_sent: "Report sent",
  enrolled: "Enrolled",
  declined: "Not this time",
  dormant: "Gone quiet",
};

export default async function EnquiryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTeacher();
  const { id } = await params;

  const row = await enquiryWithFamily(id);
  if (!row) notFound();
  const { enquiry, family } = row;

  const runs = await runsForEnquiry(id);

  /*
   * The rest of this family.
   *
   * Enquiries are per child and a parent may have several, so the row Sheeba
   * opened is one conversation out of possibly two. Without this she would
   * ring a parent about their younger child with no idea the elder is
   * already enrolled — the sort of call that loses a customer.
   */
  const siblings = await siblingsOf(enquiry.id, family.id);

  return (
    /*
      One column, one width. The layout gives this page 1152px; left
      unconstrained, a first-name box was rendering over a thousand pixels
      wide while the form beneath it sat at half that. Everything here is
      read and typed, so it all wants a reading measure rather than the full
      shell.
    */
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/teacher/enquiries"
          className="text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          ← All enquiries
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {enquiry.childFirstName ?? family.parentName ?? "Enquiry"}
        </h1>
        <p className="text-[var(--ink-muted)]">
          {family.parentName ? `${family.parentName} · ` : ""}
          {family.parentEmail}
          {family.whatsapp ? ` · ${family.whatsapp}` : ""}
        </p>
        <p className="text-sm text-[var(--ink-faint)]">
          {enquiry.source === "tool"
            ? "Came through the free check"
            : "Asked directly"}{" "}
          · {enquiry.createdAt.toLocaleDateString("en-GB")}
        </p>
      </div>

      {siblings.length > 0 && (
        <div className="rounded-[var(--radius-card)] bg-[var(--panel-butter)] px-5 py-4">
          <p className="text-sm font-medium">
            Same family &mdash; {siblings.length === 1 ? "another child" : "other children"}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {siblings.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/teacher/enquiries/${s.id}`}
                  className="text-[var(--primary)] hover:underline"
                >
                  {s.childFirstName ?? "Unnamed child"}
                </Link>{" "}
                <span className="text-[var(--ink-muted)]">
                  &middot; {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {enquiry.status !== "enrolled" && (
        <EnrolPanel
          enquiryId={enquiry.id}
          childFirstName={enquiry.childFirstName}
          childAgeBand={enquiry.childAgeBand}
          parentEmail={family.parentEmail}
          parentName={family.parentName}
        />
      )}

      <EnquiryEditor
        enquiry={{
          id: enquiry.id,
          status: enquiry.status,
          parentName: family.parentName,
          parentEmail: family.parentEmail,
          whatsapp: family.whatsapp,
          childFirstName: enquiry.childFirstName,
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
