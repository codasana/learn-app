/**
 * Helpers for the one awkward corner of the user model: children may have no
 * email address, but Better Auth requires one.
 *
 * Why blank is the intended default for a child:
 * collecting a child's email address is precisely what triggers COPPA (US),
 * GDPR-K (EU/UK), and the DPDP Act (India). A username plus a password, with
 * the PARENT's email as the contact of record, collects strictly less personal
 * data — this is the model Scratch uses and it is the reason it works.
 *
 * So a child without an email gets a placeholder on `.invalid`, an RFC 2606
 * reserved TLD guaranteed never to resolve. Mail can never be delivered to it,
 * even by accident.
 */

const PLACEHOLDER_DOMAIN = "students.invalid";

export function placeholderEmailFor(username: string): string {
  return `${username.toLowerCase()}@${PLACEHOLDER_DOMAIN}`;
}

/** True when the address is a real, routable one we may send to. */
export function hasRealEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return !email.toLowerCase().endsWith(`@${PLACEHOLDER_DOMAIN}`);
}

/**
 * Never send to a placeholder. Every send path should pass through this.
 */
export function assertSendable(email: string): void {
  if (!hasRealEmail(email)) {
    throw new Error(
      "Refusing to send to a placeholder address — this account has no real email.",
    );
  }
}

/**
 * Usernames are created by a parent and shown to a child, so they must be easy
 * to type and must not identify the child. First name plus digits is the shape
 * we suggest in the UI; full names are rejected only by guidance, not by code.
 */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

export function normaliseUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const u = normaliseUsername(raw);
  if (u.length < 3) return "Usernames need at least 3 characters.";
  if (u.length > 30) return "Usernames can be at most 30 characters.";
  if (!USERNAME_PATTERN.test(u)) {
    return "Use lowercase letters, numbers, dots, dashes or underscores.";
  }
  return null;
}
