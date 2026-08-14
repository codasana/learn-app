import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/coming-soon";
import { requireTeacher } from "@/lib/session";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage() {
  await requireTeacher();
  return (
    <ComingSoon
      title="Students"
      what="Every child you teach, with their practice this week, words learned, attendance, and a button to move them to the next week. Also where you'll add a new family."
      when="After the syllabus board — it needs somewhere for students to be enrolled into."
    />
  );
}
