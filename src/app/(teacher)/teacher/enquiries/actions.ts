"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { enquiries, enquiryFamilies } from "@/db/schema";
import { appUrl } from "@/lib/booking";
import { enquiryWithFamily, upsertEnquiry } from "@/lib/enquiries";
import { createFamilyAccounts } from "@/lib/family-accounts";
import { syncLeadById } from "@/lib/leads";
import { sendToolLink } from "@/lib/notify";
import { requireTeacher } from "@/lib/session";
import { createRun } from "@/lib/tool-runs";
import type { ToolKey } from "@/lib/tools";

export type Result = { ok: true } | { ok: false; error: string };

/** Every open conversation, with the parent behind each one. */
export async function listEnquiries(status?: string) {
  await requireTeacher();
  return db
    .select({
      id: enquiries.id,
      childFirstName: enquiries.childFirstName,
      childAgeBand: enquiries.childAgeBand,
      source: enquiries.source,
      status: enquiries.status,
      classAt: enquiries.classAt,
      createdAt: enquiries.createdAt,
      parentName: enquiryFamilies.parentName,
      parentEmail: enquiryFamilies.parentEmail,
      whatsapp: enquiryFamilies.whatsapp,
      timezone: enquiryFamilies.timezone,
    })
    .from(enquiries)
    .innerJoin(enquiryFamilies, eq(enquiryFamilies.id, enquiries.familyId))
    .where(status ? eq(enquiries.status, status as "new") : undefined)
    .orderBy(desc(enquiries.createdAt))
    .limit(200);
}

const newEnquiry = z.object({
  parentName: z.string().trim().min(1, "Add a name."),
  parentEmail: z.string().trim().email("That email doesn't look right."),
  whatsapp: z.string().trim().optional(),
  childFirstName: z.string().trim().optional(),
  childAgeBand: z.enum(["any", "8_9", "10_11"]).optional(),
  notes: z.string().trim().optional(),
});

/** The warm route: someone asked directly, no tool involved. */
export async function createEnquiry(
  formData: FormData,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireTeacher();

  const parsed = newEnquiry.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  /*
   * Merged on email, same as the two automatic routes. If Sheeba types in
   * someone who already enquired she lands on their existing row, with the
   * check and her old notes still on it, instead of quietly creating a second
   * one she will later have to reconcile by hand.
   */
  const { id } = await upsertEnquiry({
    parentName: v.parentName,
    parentEmail: v.parentEmail,
    whatsapp: v.whatsapp || null,
    childFirstName: v.childFirstName || null,
    childAgeBand: v.childAgeBand ?? null,
    notes: v.notes || null,
    source: "demo_form",
  });

  await syncLeadById(id);

  revalidatePath("/teacher/enquiries");
  return { ok: true, id };
}

const update = z.object({
  status: z.enum([
    "new",
    "class_scheduled",
    "class_done",
    "report_sent",
    "enrolled",
    "declined",
    "dormant",
  ]),
  suggestedLevel: z.string().optional(),
  startingLevel: z.string().optional(),
  teacherNotes: z.string().optional(),
  notes: z.string().optional(),
});

const level = (raw?: string) => {
  const n = Number(raw);
  return raw && Number.isInteger(n) && n >= 1 && n <= 4 ? n : null;
};

export async function updateEnquiry(
  id: string,
  formData: FormData,
): Promise<Result> {
  await requireTeacher();

  const parsed = update.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  await db
    .update(enquiries)
    .set({
      status: v.status,
      suggestedLevel: level(v.suggestedLevel),
      startingLevel: level(v.startingLevel),
      teacherNotes: v.teacherNotes?.trim() || null,
      notes: v.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(enquiries.id, id));

  /*
   * Retention is a promise to the PARENT, disclosed on the form, so the clock
   * lives on the family — and it can only start once EVERY child of theirs is
   * declined. Deleting a family because one of two children was turned away
   * would take the other's record with it.
   */
  const [me] = await db
    .select({ familyId: enquiries.familyId })
    .from(enquiries)
    .where(eq(enquiries.id, id))
    .limit(1);

  if (me) {
    const kids = await db
      .select({ status: enquiries.status })
      .from(enquiries)
      .where(eq(enquiries.familyId, me.familyId));
    const allDeclined = kids.every((k) => k.status === "declined");
    await db
      .update(enquiryFamilies)
      .set({
        purgeAfter: allDeclined
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(enquiryFamilies.id, me.familyId));
  }

  // The stage a parent is at is the whole input to their automation, so this
  // is the most important sync of the lot: leaving Loops on "enquired" after
  // Sheeba marks someone enrolled means a paying customer keeps getting
  // "still thinking about it?" mail.
  await syncLeadById(id);

  revalidatePath("/teacher/enquiries");
  revalidatePath(`/teacher/enquiries/${id}`);
  return { ok: true };
}

/**
 * A tool link for a family who has already enquired.
 *
 * The run is created with the enquiry attached, so nobody is asked for an
 * email they have already given — and the result lands on this screen without
 * anyone having to match it up by hand.
 */
export async function issueToolLink(
  enquiryId: string,
  tool: ToolKey,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireTeacher();

  const row = await enquiryWithFamily(enquiryId);
  if (!row) return { ok: false, error: "That enquiry no longer exists." };

  const run = await createRun({
    tool,
    enquiryId,
    childFirstName: row.enquiry.childFirstName,
    childAgeBand: row.enquiry.childAgeBand,
  });

  revalidatePath(`/teacher/enquiries/${enquiryId}`);
  return { ok: true, url: `/check/${run.token}` };
}

/**
 * Issue the link AND send it, in one press.
 *
 * The button used to say "Send them the level check" and then hand Sheeba a
 * URL to paste somewhere herself. We already know the address — we are holding
 * it two lines above — so the copy was a promise the code did not keep, and
 * the work it left behind was the fiddly, forgettable half.
 *
 * WhatsApp is still hers to press: a wa.me link opens her own account with the
 * message written, which is right. Sending on someone's behalf into a personal
 * chat is a different thing from sending an email from the programme, and it
 * needs her hand on it.
 */
export async function emailToolLink(
  enquiryId: string,
  tool: ToolKey,
): Promise<{ ok: true; url: string; sentTo: string } | { ok: false; error: string }> {
  await requireTeacher();

  const row = await enquiryWithFamily(enquiryId);
  if (!row) return { ok: false, error: "That enquiry no longer exists." };
  const { enquiry, family } = row;

  const run = await createRun({
    tool,
    enquiryId,
    childFirstName: enquiry.childFirstName,
    childAgeBand: enquiry.childAgeBand,
  });

  const url = appUrl(`/check/${run.token}`);
  const sent = await sendToolLink({
    to: family.parentEmail,
    parentName: family.parentName,
    childFirstName: enquiry.childFirstName,
    url,
  });

  // The run is left in place on a failed send. It costs nothing, and the link
  // is still valid — she can copy it or send it on WhatsApp instead.
  if (!sent.ok) return { ok: false, error: sent.error ?? "That didn't send." };

  revalidatePath(`/teacher/enquiries/${enquiryId}`);
  return { ok: true, url, sentTo: family.parentEmail };
}

/* ------------------------------------------------------------------ */
/* Converting                                                          */
/* ------------------------------------------------------------------ */

const enrolForm = z.object({
  childFirstName: z.string().trim().min(1, "The child needs a first name."),
  childAgeBand: z.enum(["8_9", "10_11", "any"]),
  avatar: z.string().trim().min(1).default("fox"),
  consentNote: z.string().trim().optional(),
});

export type EnrolResult =
  | { ok: true; childId: string; parentPassword: string | null }
  | { ok: false; error: string };

/**
 * Enrol this child, from the enquiry Sheeba is already reading.
 *
 * The other direction — go to the students page and type the family in again
 * — was the only route, and it threw away everything at the moment it was
 * worth most: the check result, what she saw in the free session, the level
 * she decided on. All of it stayed on the enquiry while a blank child record
 * started beside it.
 *
 * Adding a family from scratch still exists on the students page, for anyone
 * who arrived by a route the funnel never saw. This is the common case, not
 * the only one.
 */
export async function enrolFromEnquiry(
  enquiryId: string,
  formData: FormData,
): Promise<EnrolResult> {
  await requireTeacher();

  const row = await enquiryWithFamily(enquiryId);
  if (!row) return { ok: false, error: "That enquiry no longer exists." };
  const { enquiry, family } = row;

  const parsed = enrolForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const v = parsed.data;

  if (!family.parentName) {
    return { ok: false, error: "Add the parent's name to this enquiry first." };
  }

  const res = await createFamilyAccounts({
    parentEmail: family.parentEmail,
    parentName: family.parentName,
    whatsapp: family.whatsapp,
    timezone: family.timezone,
    childFirstName: v.childFirstName,
    childAgeBand: v.childAgeBand,
    avatar: v.avatar,
    fromEnquiryId: enquiry.id,
    consentNote: v.consentNote || null,
  });
  if (!res.ok) return res;

  /*
   * Close the loop.
   *
   * Marking the enquiry enrolled here, rather than leaving Sheeba to go back
   * and tick it, is the difference between a funnel that reports honestly and
   * one where half the conversions sit at "class done" forever. It is also
   * what stops Loops chasing a family who has just started paying.
   */
  await db
    .update(enquiries)
    .set({ status: "enrolled", updatedAt: new Date() })
    .where(eq(enquiries.id, enquiry.id));

  await syncLeadById(enquiry.id);

  revalidatePath("/teacher/enquiries");
  revalidatePath(`/teacher/enquiries/${enquiry.id}`);
  revalidatePath("/teacher/students");

  return {
    ok: true,
    childId: res.childId,
    parentPassword: res.parentPassword,
  };
}
