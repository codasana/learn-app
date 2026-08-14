import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/coming-soon";
import { requireTeacher } from "@/lib/session";

export const metadata: Metadata = { title: "Writing" };

export default async function WritingPage() {
  await requireTeacher();
  return (
    <ComingSoon
      title="Writing"
      what="Each child's writing beside a suggested response you can edit, add a voice note to, and release. Nothing reaches a child until you release it."
      when="Once children can submit writing, in November."
    />
  );
}
