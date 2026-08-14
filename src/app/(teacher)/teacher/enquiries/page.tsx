import type { Metadata } from "next";
import Link from "next/link";

import { requireTeacher } from "@/lib/session";
import { unclaimedRuns } from "@/lib/tool-runs";
import { toolTitle } from "@/lib/tools";

import { listEnquiries } from "./actions";
import { NewEnquiry } from "./new-enquiry";

export const metadata: Metadata = { title: "Enquiries" };

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  class_scheduled: "Class booked",
  class_done: "Class done",
  report_sent: "Report sent",
  enrolled: "Enrolled",
  declined: "Not this time",
  dormant: "Gone quiet",
};

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireTeacher();
  const { status } = await searchParams;

  const [rows, unclaimed] = await Promise.all([
    listEnquiries(status),
    unclaimedRuns(20),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Enquiries</h1>
        <p className="max-w-2xl text-[var(--ink-muted)]">
          Families who have shown interest but haven&rsquo;t started. They arrive
          either by finishing the free check and asking for the report, or by
          asking you directly. Nobody here has an account yet.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/teacher/enquiries"
          className={`rounded-[var(--radius-pill)] px-3 py-1 ${
            !status
              ? "bg-[var(--primary)] text-[var(--ink-on-primary)]"
              : "bg-[var(--surface-sunken)] text-[var(--ink-muted)]"
          }`}
        >
          Everyone
        </Link>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <Link
            key={value}
            href={`/teacher/enquiries?status=${value}`}
            className={`rounded-[var(--radius-pill)] px-3 py-1 ${
              status === value
                ? "bg-[var(--primary)] text-[var(--ink-on-primary)]"
                : "bg-[var(--surface-sunken)] text-[var(--ink-muted)]"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-10">
          <p className="font-medium">Nobody here yet.</p>
          <p className="mt-1 text-[var(--ink-muted)]">
            When someone finishes the free check and asks for the report, they
            appear here on their own. You can also add a family yourself.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((e) => (
            <li key={e.id}>
              <Link
                href={`/teacher/enquiries/${e.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition-colors hover:border-[var(--border-strong)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-medium">
                    {e.childFirstName ?? e.parentName ?? "Someone"}
                  </span>
                  {e.parentName && e.childFirstName ? (
                    <span className="text-[var(--ink-muted)]">
                      {" "}
                      · {e.parentName}
                    </span>
                  ) : null}
                  <span className="block text-sm text-[var(--ink-faint)]">
                    {e.parentEmail ?? "no email"} ·{" "}
                    {e.source === "tool" ? "took the check" : "asked directly"}
                  </span>
                </span>
                <span className="text-sm text-[var(--ink-muted)]">
                  {STATUS_LABELS[e.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewEnquiry hasAny={rows.length > 0} />

      {unclaimed.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-medium">Checks nobody claimed</h2>
            <p className="text-sm text-[var(--ink-muted)]">
              Finished, but the family didn&rsquo;t ask for the report. Worth watching
              as a number — it tells you whether the ask is landing.
            </p>
          </div>
          <ul className="space-y-1 text-sm text-[var(--ink-muted)]">
            {unclaimed.map((r) => (
              <li key={r.id}>
                {r.childFirstName ?? "Anonymous"} · {toolTitle(r.tool)} ·{" "}
                {r.completedAt?.toLocaleDateString("en-GB")}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
