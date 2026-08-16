import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AutometteForm } from "@/components/site/automette-form";
import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { teacherName } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Book a free session",
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

          The form itself renders neither — `heading: null` and an empty
          description, set through the API. It is fields and nothing else, so
          the page owns the framing.
        */}
        <h1 className="text-3xl font-bold sm:text-4xl">Book a free session</h1>
        <p className="mt-4 text-lg text-[var(--ink-muted)]">
          Half an hour with {teacherName()} — a proper conversation with your
          child, a sense of where they are, and an honest answer on whether
          this is the right thing for them. Nothing to prepare, nothing to pay.
        </p>

        {/*
          A lilac panel, matching every other section of the site. The embed is
          genuinely transparent, so the fields sit straight on it rather than
          on a card of their own — one surface, not two.

          The padding is at least the panel's own 40px corner radius, so the
          first field label clears the curve. At less than that, the top-left
          of "Your name" sits in the bite the rounded corner takes out.
        */}
        <div className="mt-8 rounded-[var(--radius-panel)] bg-[var(--panel-lilac)] p-6 sm:p-10">
          <AutometteForm src={embed} title="Book a free session" />
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
