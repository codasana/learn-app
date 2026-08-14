import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("text-sm font-medium text-[var(--ink)]", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)]",
        "min-h-11 px-3 text-base text-[var(--ink)] placeholder:text-[var(--ink-faint)]",
        "transition-colors outline-none focus:border-[var(--primary)]",
        "disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)]",
        "min-h-24 px-3 py-2 text-base text-[var(--ink)] placeholder:text-[var(--ink-faint)]",
        "transition-colors outline-none focus:border-[var(--primary)]",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)]",
        "min-h-11 px-3 text-base text-[var(--ink)]",
        "transition-colors outline-none focus:border-[var(--primary)]",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-sm text-[var(--ink-muted)]">{hint}</p> : null}
    </div>
  );
}

/**
 * Form-level message. Amber, never red — the palette has no red token, and a
 * failed login is not a failure of the person reading it.
 */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-[var(--radius)] bg-[var(--notyet-soft)] px-3 py-2 text-sm text-[var(--accent-ink)]"
    >
      {children}
    </p>
  );
}
