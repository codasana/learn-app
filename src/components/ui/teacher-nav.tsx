"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * The teacher's navigation.
 *
 * Six flat items, no dropdowns. Six is under the number where people start
 * hunting, and grouping them into menus would hide the two she uses hourly
 * behind a click.
 *
 * The current section is marked. Without it every page looks the same at a
 * glance, which matters most for the person who lives in this screen daily and
 * least for the person demoing it once.
 *
 * `/teacher` matches exactly; everything else matches its prefix, so a unit
 * page still lights up "Syllabus".
 */
const NAV = [
  { href: "/teacher", label: "Home" },
  { href: "/teacher/content", label: "Content" },
  { href: "/teacher/syllabus", label: "Syllabus" },
  { href: "/teacher/students", label: "Students" },
  { href: "/teacher/enquiries", label: "Enquiries" },
  { href: "/teacher/writing", label: "Writing" },
];

export function TeacherNav() {
  const pathname = usePathname();
  const current = useRef<HTMLAnchorElement>(null);

  /*
   * On a phone the bar scrolls, and the page you are on is frequently past the
   * right edge — so the one item worth seeing is the one you cannot. Pull it
   * into view. `block: "nearest"` keeps the page itself from jumping.
   */
  useEffect(() => {
    current.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  const isCurrent = (href: string) =>
    href === "/teacher" ? pathname === "/teacher" : pathname.startsWith(href);

  return (
    // Scrolls rather than wraps on a narrow screen: a nav that reflows to two
    // rows pushes the page down and looks broken. The scrollbar is hidden
    // because a horizontal bar under six words is uglier than the overflow.
    <nav className="-mx-2 flex flex-1 gap-1 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {NAV.map((item) => {
        const active = isCurrent(item.href);
        return (
          <Link
            key={item.href}
            ref={active ? current : undefined}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-[var(--primary-soft)] font-medium text-[var(--primary)]"
                : "text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
