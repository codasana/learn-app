/**
 * The product name lives here and nowhere else.
 *
 * "English Ladder" is a PLACEHOLDER. Renaming must be a single edit to this
 * file — so never hardcode the name in a component, a page, a document
 * template, or an email. Import from here instead.
 *
 * Equally: no design or copy may lean on a ladder metaphor — no rungs, no
 * climbing, no steps, no "next rung" language. The metaphor dies with the name.
 */

export const brand = {
  /** Display name. Placeholder — see above. */
  name: "English Ladder",

  /** Used in page titles: "Today · English Ladder" */
  titleSuffix: "English Ladder",

  /** One plain sentence. No superlatives, no marketing adjectives. */
  tagline: "Live English classes for children, with daily practice in between.",

  /** Legal entity, for footers and generated documents. */
  legalEntity: "Learn Kraft Info Solutions LLP",
  legalCity: "Bengaluru, India",

  /** Filled in when the domain is settled. */
  domain: "",
  supportWhatsapp: "",
  supportEmail: "",
} as const;

export function pageTitle(section?: string) {
  return section ? `${section} · ${brand.titleSuffix}` : brand.titleSuffix;
}
