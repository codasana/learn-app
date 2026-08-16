import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { childProfiles, users } from "@/db/schema";
import { createAccount } from "@/lib/create-account";
import { readablePassword } from "@/lib/passwords";

/**
 * Turning a family into accounts. The one place it happens.
 *
 * Named for what it makes rather than for the funnel step, because
 * `enrolChild` already means something else entirely on the students page:
 * putting an existing child onto a syllabus.
 *
 * Two screens reach this — "add a family" on the students page, and "enrol"
 * on an enquiry — and the fiddly part is identical for both: a parent may
 * already exist, because they have a second child or because they came
 * through the funnel months ago. Getting that wrong creates a duplicate
 * parent account, which is far harder to unpick than it looks once a child is
 * signed in under one of them.
 *
 * There is no public sign-up, so this is the only door into the programme.
 */

/**
 * Which privacy notice the parent agreed to.
 *
 * A bare timestamp cannot say WHAT was consented to, and notices change. Bump
 * this whenever the wording a parent is shown changes, so old consents stay
 * attached to the text those parents were actually given.
 */
export const CONSENT_VERSION = "2026-08-16";

export type FamilyInput = {
  parentEmail: string;
  parentName: string;
  whatsapp?: string | null;
  timezone: string;
  childFirstName: string;
  childAgeBand: "8_9" | "10_11" | "any";
  avatar: string;
  /** The enquiry this child came from, when there was one. */
  fromEnquiryId?: string | null;
  /**
   * How consent was obtained, in her words. Absent means not recorded —
   * which is honest, and better than a timestamp implying a ceremony that
   * never happened.
   */
  consentNote?: string | null;
};

export type FamilyAccountResult =
  | { ok: true; childId: string; parentId: string; parentPassword: string | null }
  | { ok: false; error: string };

export async function createFamilyAccounts(
  input: FamilyInput,
): Promise<FamilyAccountResult> {
  const email = input.parentEmail.trim().toLowerCase();

  let parent = await db.query.users.findFirst({ where: eq(users.email, email) });
  let parentPassword: string | null = null;

  if (parent) {
    if (parent.role === "student") {
      return {
        ok: false,
        error: "That email belongs to a student account, not a parent.",
      };
    }
  } else {
    /*
     * The one-time password is returned to be shown on screen ONCE, for the
     * teacher to pass on however she already talks to that family. It is
     * never emailed: a password in an inbox outlives the conversation. A
     * set-your-own-password invite link is the right answer and is not built.
     */
    parentPassword = readablePassword();

    // Deliberately NOT signUpEmail: that would hand the teacher this parent's
    // session and sign her out of her own. See lib/create-account.
    const created = await createAccount({
      email,
      name: input.parentName,
      password: parentPassword,
      role: "parent",
      timezone: input.timezone,
      whatsapp: input.whatsapp || null,
    });
    parent = await db.query.users.findFirst({ where: eq(users.id, created.id) });
  }

  if (!parent) return { ok: false, error: "Could not create that account." };

  const [child] = await db
    .insert(childProfiles)
    .values({
      parentId: parent.id,
      firstName: input.childFirstName,
      ageBand: input.childAgeBand,
      avatar: input.avatar,
      fromEnquiryId: input.fromEnquiryId || null,
      ...(input.consentNote
        ? {
            consentAt: new Date(),
            consentVersion: CONSENT_VERSION,
            consentNote: input.consentNote,
          }
        : {}),
    })
    .returning({ id: childProfiles.id });

  return {
    ok: true,
    childId: child.id,
    parentId: parent.id,
    parentPassword,
  };
}
