import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";

import { brand, pageTitle } from "@/lib/brand";

import "./globals.css";

/**
 * Fraunces for headlines. A serif with a little wonk in it — slightly bookish,
 * slightly hand-cut, and nothing like the geometric sans every other learning
 * company sets its promises in. A page claiming that one teacher writes
 * everything herself should look written, not deployed.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK"],
});

/** Inter for everything else, where being invisible is the whole job. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
    <html lang="en" className={`h-full ${fraunces.variable} ${inter.variable}`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
