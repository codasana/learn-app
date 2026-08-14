import type { Metadata } from "next";
import { Figtree } from "next/font/google";

import { brand, pageTitle } from "@/lib/brand";

import "./globals.css";

/**
 * One family, every weight. Figtree is warm without tipping into the rounded
 * faces that read as children's television, and it stays legible from a 14px
 * label to a 60px headline — which matters when the same tokens dress both a
 * marketing page and a teacher's admin screen.
 */
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: pageTitle(),
    template: `%s · ${brand.titleSuffix}`,
  },
  description: brand.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full ${figtree.variable}`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
