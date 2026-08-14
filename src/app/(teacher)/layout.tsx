import Link from "next/link";

import { SignOut } from "@/components/ui/sign-out";
import { brand } from "@/lib/brand";
import { requireTeacher } from "@/lib/session";

const nav = [
  { href: "/teacher", label: "Home" },
  { href: "/teacher/content", label: "Content" },
  { href: "/teacher/syllabus", label: "Syllabus" },
  { href: "/teacher/students", label: "Students" },
  { href: "/teacher/enquiries", label: "Enquiries" },
  { href: "/teacher/writing", label: "Writing" },
];

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
        <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-6 py-3">
          <Link href="/teacher" className="font-semibold">
            {brand.name}
          </Link>
          <nav className="flex flex-1 gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[var(--radius-sm)] px-3 py-1.5 text-sm text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-[var(--ink-faint)] sm:inline">
              {user.email}
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
