import type { Metadata } from "next";

import { brand, pageTitle } from "@/lib/brand";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: pageTitle(),
    template: `%s · ${brand.titleSuffix}`,
  },
  description: brand.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
