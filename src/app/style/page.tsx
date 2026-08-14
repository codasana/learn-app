import type { Metadata } from "next";
import { Figtree, Outfit, Plus_Jakarta_Sans } from "next/font/google";

/**
 * Three style directions, rendered rather than described.
 *
 * Kept on purpose, so the choice can be shown to someone else and revisited.
 * Arguing about typefaces in prose wastes everyone's time when the thing can
 * just be looked at. B won and is now the real design; A and C stay here as
 * the record of what was rejected. Do not delete without asking.
 *
 * Each block is self-contained: its own fonts, its own colours as inline
 * custom properties, no dependency on globals.css. Whichever wins becomes the
 * real tokens.
 */

const outfit = Outfit({ subsets: ["latin"], variable: "--v-outfit" });
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--v-jakarta",
});
const figtree = Figtree({ subsets: ["latin"], variable: "--v-figtree" });

export const metadata: Metadata = {
  title: "Style directions",
  robots: { index: false, follow: false },
};

export default function StylePage() {
  return (
    <div className={`${outfit.variable} ${jakarta.variable} ${figtree.variable}`}>
      <VariantA />
      <VariantB />
      <VariantC />
    </div>
  );
}

/* ================================================================== */
/* A — Bright and confident                                            */
/* ================================================================== */

function VariantA() {
  return (
    <section
      id="a"
      style={
        {
          "--bg": "#ffffff",
          "--tint": "#f3f0ff",
          "--ink": "#17123a",
          "--muted": "#5a5578",
          "--brand": "#5b3df5",
          "--coral": "#ff6a45",
          "--sun": "#ffc94a",
          "--mint": "#25d3a4",
          fontFamily: "var(--v-jakarta)",
          background: "var(--bg)",
          color: "var(--ink)",
        } as React.CSSProperties
      }
      className="px-6 py-16"
    >
      <Tag>A · Bright and confident</Tag>

      <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold"
            style={{ background: "var(--tint)", color: "var(--brand)" }}
          >
            Free · no sign-up
          </span>

          <h1
            className="mt-5 text-5xl leading-[1.05] font-extrabold tracking-tight lg:text-6xl"
            style={{ fontFamily: "var(--v-outfit)" }}
          >
            Is your child&rsquo;s English{" "}
            <span
              className="rounded-lg px-2"
              style={{ background: "var(--sun)" }}
            >
              really
            </span>{" "}
            where you think?
          </h1>

          <p
            className="mt-5 max-w-lg text-lg"
            style={{ color: "var(--muted)" }}
          >
            Most children pass the test and still won&rsquo;t speak up in a
            room. Find out in twelve minutes.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span
              className="rounded-full px-7 py-4 text-lg font-bold text-white"
              style={{
                background: "var(--brand)",
                boxShadow: "0 6px 0 #4426d6",
              }}
            >
              Check my child&rsquo;s English
            </span>
            <span
              className="rounded-full px-6 py-4 font-semibold"
              style={{ background: "var(--tint)", color: "var(--brand)" }}
            >
              How classes work
            </span>
          </div>

          <div className="mt-8 flex gap-6 text-sm font-semibold">
            {[
              ["12 min", "var(--coral)"],
              ["No email", "var(--mint)"],
              ["Result now", "var(--brand)"],
            ].map(([label, c]) => (
              <span key={label} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: c }}
                />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <div
            className="aspect-4/5 w-full rounded-[2rem]"
            style={{ background: "var(--tint)" }}
          />
          <div
            className="absolute -top-4 -right-4 h-24 w-24 rounded-full"
            style={{ background: "var(--sun)" }}
          />
          <div
            className="absolute -bottom-5 -left-5 h-20 w-20 rounded-[1.25rem] rotate-12"
            style={{ background: "var(--coral)" }}
          />
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* B — Soft and friendly                                               */
/* ================================================================== */

function VariantB() {
  return (
    <section
      id="b"
      style={
        {
          "--bg": "#fbf9ff",
          "--ink": "#20233d",
          "--muted": "#5d6180",
          "--brand": "#4f46e5",
          "--peach": "#ffe4d6",
          "--mint": "#d6f5ea",
          "--lilac": "#e8e4ff",
          fontFamily: "var(--v-figtree)",
          background: "var(--bg)",
          color: "var(--ink)",
        } as React.CSSProperties
      }
      className="px-6 py-16"
    >
      <Tag>B · Soft and friendly</Tag>

      <div className="mx-auto max-w-5xl">
        <div
          className="rounded-[2.5rem] px-8 py-14 sm:px-14"
          style={{ background: "var(--lilac)" }}
        >
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <h1 className="text-4xl leading-[1.1] font-bold tracking-tight lg:text-5xl">
                Is your child&rsquo;s English really where you think it is?
              </h1>
              <p className="mt-5 max-w-lg text-lg" style={{ color: "var(--muted)" }}>
                A gentle twelve-minute check. No sign-up, no marks out of ten
                for you to worry about — just a clear picture.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <span
                  className="rounded-2xl px-7 py-4 text-lg font-semibold text-white"
                  style={{ background: "var(--brand)" }}
                >
                  Start the free check
                </span>
                <span
                  className="rounded-2xl bg-white px-6 py-4 font-semibold"
                  style={{ color: "var(--brand)" }}
                >
                  How classes work
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div
                className="aspect-square rounded-[1.75rem]"
                style={{ background: "var(--peach)" }}
              />
              <div
                className="mt-8 aspect-square rounded-[1.75rem]"
                style={{ background: "var(--mint)" }}
              />
              <div className="aspect-square rounded-[1.75rem] bg-white" />
              <div
                className="mt-8 aspect-square rounded-[1.75rem]"
                style={{ background: "var(--brand)", opacity: 0.15 }}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["Two live classes a week", "var(--peach)"],
            ["Ten minutes a day", "var(--mint)"],
            ["One teacher, every week", "var(--lilac)"],
          ].map(([label, bg]) => (
            <div
              key={label}
              className="rounded-3xl px-6 py-8 font-semibold"
              style={{ background: bg }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/* C — Bold blocks                                                     */
/* ================================================================== */

function VariantC() {
  return (
    <section
      id="c"
      style={
        {
          "--bg": "#0f1020",
          "--ink": "#ffffff",
          "--muted": "#a7a6c4",
          "--lime": "#c8f560",
          "--pink": "#ff5c8a",
          "--sky": "#5ad2ff",
          fontFamily: "var(--v-jakarta)",
          background: "var(--bg)",
          color: "var(--ink)",
        } as React.CSSProperties
      }
      className="px-6 py-16"
    >
      <Tag dark>C · Bold blocks</Tag>

      <div className="mx-auto max-w-5xl">
        <h1
          className="text-5xl leading-[0.98] font-extrabold tracking-tight lg:text-7xl"
          style={{ fontFamily: "var(--v-outfit)" }}
        >
          Is your child&rsquo;s
          <br />
          English really{" "}
          <span style={{ color: "var(--lime)" }}>where</span>
          <br />
          you think it is?
        </h1>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <span
            className="rounded-full px-8 py-4 text-lg font-bold"
            style={{ background: "var(--lime)", color: "#0f1020" }}
          >
            Check it free
          </span>
          <span className="text-lg" style={{ color: "var(--muted)" }}>
            12 minutes · no sign-up
          </span>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            ["Speaking", "var(--pink)", "#0f1020"],
            ["Writing", "var(--sky)", "#0f1020"],
            ["Reading", "var(--lime)", "#0f1020"],
          ].map(([label, bg, fg]) => (
            <div
              key={label}
              className="rounded-[1.5rem] px-6 py-14 text-3xl font-extrabold"
              style={{
                background: bg,
                color: fg,
                fontFamily: "var(--v-outfit)",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Tag({
  children,
  dark,
}: {
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <p
      className="mx-auto mb-10 max-w-5xl text-xs font-bold tracking-[0.2em] uppercase"
      style={{ color: dark ? "#6f6e94" : "#9a97b5" }}
    >
      {children}
    </p>
  );
}
