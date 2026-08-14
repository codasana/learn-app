import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/coming-soon";
import { requireTeacher } from "@/lib/session";

export const metadata: Metadata = { title: "Syllabus" };

export default async function SyllabusPage() {
  await requireTeacher();
  return (
    <ComingSoon
      title="Syllabus"
      what="A twelve-week board where you drag the things you've written into each week, and set up the two classes. Moving a topic from week five to week three will be one drag."
      when="Next thing being built."
      nextHref="/teacher/content"
      nextLabel="Write content in the meantime"
    />
  );
}
