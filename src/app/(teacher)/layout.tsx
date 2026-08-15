import Link from "next/link";

import { SignOut } from "@/components/ui/sign-out";
import { TeacherNav } from "@/components/ui/teacher-nav";
import { brand } from "@/lib/brand";
import { requireTeacher } from "@/lib/session";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Every teacher route is gated here, server-side. Never rely on hiding links.
  const user = await requireTeacher();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-6 py-3 sm:gap-6">
          <Link href="/teacher" className="shrink-0 font-semibold">
            {brand.name}
          </Link>

          <TeacherNav />

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-sm text-[var(--ink-faint)] lg:inline">
              {user.name}
            </span>
            <SignOut />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
