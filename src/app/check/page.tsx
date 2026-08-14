import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Field, Input, Notice } from "@/components/ui/field";
import { brand } from "@/lib/brand";
import { TOOLS } from "@/lib/tools";

import { startCheck } from "./actions";

const tool = TOOLS.level_check;

export const metadata: Metadata = {
  title: tool.title,
  description: tool.blurb,
};

export default async function CheckStartPage({
  searchParams,
}: {
  searchParams: Promise<{ busy?: string }>;
}) {
  const { busy } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-16">
      <p className="text-sm text-[var(--ink-faint)]">{brand.name}</p>
      <h1 className="mt-2 text-3xl font-semibold">{tool.title}</h1>
      <p className="mt-3 text-lg text-[var(--ink-muted)]">{tool.blurb}</p>

      {busy ? (
        <div className="mt-6">
          <Notice>
            That&rsquo;s a lot of checks from one place in a short time. Please try
            again in a little while.
          </Notice>
        </div>
      ) : null}

      <form action={startCheck} className="mt-8 space-y-5">
        <Field
          label="Your child's first name"
          htmlFor="childFirstName"
          hint="Only so the result can use their name. You can leave it empty."
        >
          <Input
            id="childFirstName"
            name="childFirstName"
            maxLength={40}
            autoComplete="off"
            placeholder="Nila"
          />
        </Field>

        <Button type="submit" size="lg">
          Start the check
        </Button>
      </form>

      <div className="mt-10 space-y-3 text-[var(--ink-muted)]">
        <p>
          There are {tool.minutes} minutes of questions — some about words,
          one short story to read, and one short piece to listen to. Your child
          can do it on their own.
        </p>
        <p>
          You&rsquo;ll see the result as soon as they finish. We don&rsquo;t ask for an
          email to start, and nothing is shared with anyone.
        </p>
      </div>
    </main>
  );
}
