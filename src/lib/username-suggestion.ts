/**
 * A username suggestion from a first name: "meera" → "meera7".
 *
 * Deliberately not identifying — first name plus a digit, never a surname or a
 * birth year. It is only a starting point; whoever is filling the form can type
 * whatever they like over it.
 *
 * `Math.random` on purpose: this runs in the browser, where `node:crypto` does
 * not exist, and a suggestion nobody is required to accept needs no entropy
 * guarantees. The password generator is a different matter and stays on the
 * server — see lib/passwords.
 */
export function suggestUsername(firstName: string): string {
  const base = firstName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
  return `${base || "student"}${Math.floor(Math.random() * 99) + 1}`;
}
