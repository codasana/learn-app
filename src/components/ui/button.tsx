import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "quiet";
type Size = "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--ink-on-primary)] hover:bg-[var(--primary-hover)] shadow-[var(--shadow-sm)]",
  secondary:
    "bg-[var(--surface)] text-[var(--ink)] border border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]",
  quiet: "bg-transparent text-[var(--ink-muted)] hover:text-[var(--ink)]",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-4 text-base",
  /** Kid mode always uses lg — 48px minimum touch target. */
  lg: "min-h-[var(--tap-target)] px-6 text-lg w-full",
};

export function Button({
  variant = "primary",
  size = "md",
  asChild = false,
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius)]",
        "font-medium transition-colors duration-[var(--duration-fast)]",
        "disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
