import type { Metadata } from "next";
import Link from "next/link";

import { avatarEmoji } from "@/lib/avatars";
import { AGE_BANDS } from "@/lib/content-types";
import { requireTeacher } from "@/lib/session";

import { availableSyllabi, listStudents } from "./actions";
import { NewFamily } from "./new-family";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage() {
  await requireTeacher();

  const [students, syllabuses] = await Promise.all([
    listStudents(),
    availableSyllabi(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Students</h1>
        <p className="max-w-2xl text-[var(--ink-muted)]">
          Every child you teach, and the family they belong to. Nobody signs up
          on their own — you add them here, and the parent gets the account.
        </p>
      </div>

      {students.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-10">
          <p className="font-medium">No students yet.</p>
          <p className="mt-1 text-[var(--ink-muted)]">
            Add the first family and you can put their child on a syllabus
            straight away.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {students.map((s) => (
            <li key={s.childId}>
              <Link
                href={`/teacher/students/${s.childId}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition-colors hover:border-[var(--border-strong)]"
              >
                <span className="text-2xl" aria-hidden="true">
                  {avatarEmoji(s.avatar)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="font-medium">{s.firstName}</span>
                  <span className="text-[var(--ink-muted)]">
                    {" "}
                    · {AGE_BANDS[s.ageBand]}
                  </span>
                  <span className="block text-sm text-[var(--ink-faint)]">
                    {s.parentName} · {s.parentEmail}
                  </span>
                </span>

                <span className="text-sm text-[var(--ink-muted)]">
                  {s.syllabusName ? (
                    <>
                      {s.syllabusName}
                      <span className="text-[var(--ink-faint)]">
                        {" "}
                        · {s.unitLabel?.toLowerCase() ?? "unit"} {s.currentUnit}
                      </span>
                    </>
                  ) : (
                    <span className="text-[var(--ink-faint)]">
                      Not on a syllabus yet
                    </span>
                  )}
                </span>

                <span
                  className="text-sm text-[var(--ink-faint)]"
                  title={
                    s.childUserId
                      ? "This child can sign in on their own"
                      : "No sign-in yet — they can still use the parent's account"
                  }
                >
                  {s.childUserId ? "has a sign-in" : "no sign-in"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewFamily
        hasAny={students.length > 0}
        canEnrol={syllabuses.length > 0}
      />
    </div>
  );
}
