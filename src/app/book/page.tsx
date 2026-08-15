import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AutometteForm } from "@/components/site/automette-form";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";

export const metadata: Metadata = {
  title: "Book a free class",
  description:
    "Half an hour with the teacher. No obligation, nothing to prepare, and nothing to pay.",
};

/**
 * The warm path: people who would rather talk to a person than take a test.
 *
 * On our own domain rather than a hand-off to forms.automette.com. A parent
 * deciding whether to trust a small programme should not be bounced to a
 * different address at the moment they are about to give their email.
 */
export default function BookPage() {
  const embed = process.env.AUTOMETTE_FORM_URL
    ? `${process.env.AUTOMETTE_FORM_URL.replace(/\/+$/, "")}/embed`
    : null;

  if (!embed) notFound();

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        {/*
          The heading and the promise are ours: our voice, our typography, and
          indexable — an iframe's heading is not this page's heading.

          The form still renders its own title and description underneath,
          which duplicates this. Automette has been asked for an embed that
          omits them, since a host page almost always supplies its own. Until
          then the duplication is visible and nothing is public.
        */}
        <h1 className="text-3xl font-bold sm:text-4xl">Book a free class</h1>
        <p className="mt-4 text-lg text-[var(--ink-muted)]">
          Half an hour with Sheeba. She will talk to your child, get a sense of
          where they are, and tell you honestly whether this is the right thing
          for them. Nothing to prepare, and nothing to pay.
        </p>

        {/*
          White, not lilac. The embed paints its own near-white card, so a
          coloured mat behind it reads as two surfaces disagreeing rather than
          as a frame. Matching the surface makes the seam disappear. When the
          embed can be made transparent this can go back to being a panel.
        */}
        <div className="mt-8 overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface)]">
          <AutometteForm src={embed} title="Book a free class" />
        </div>

        <p className="mt-8 text-center text-[var(--ink-muted)]">
          Would you rather see where your child stands first?{" "}
          <Link href="/check" className="text-[var(--primary)] underline underline-offset-2">
            The free check takes twelve minutes
          </Link>{" "}
          and needs no sign-up.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
