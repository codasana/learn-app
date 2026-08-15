"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { enquiries } from "@/db/schema";
import { syncLeadById } from "@/lib/leads";
import { requireTeacher } from "@/lib/session";
import { createRun } from "@/lib/tool-runs";
import type { ToolKey } from "@/lib/tools";

export type Result = { ok: true } | { ok: false; error: string };

export async function listEnquiries(status?: string) {
  await requireTeacher();
  return db
    .select()
    .from(enquiries)
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

  const [row] = await db
    .insert(enquiries)
    .values({
      parentName: v.parentName,
      parentEmail: v.parentEmail.toLowerCase(),
      whatsapp: v.whatsapp || null,
      childFirstName: v.childFirstName || null,
      childAgeBand: v.childAgeBand ?? null,
      notes: v.notes || null,
      source: "demo_form",
    })
    .returning({ id: enquiries.id });

  await syncLeadById(row.id);

  revalidatePath("/teacher/enquiries");
  return { ok: true, id: row.id };
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
      // Declining starts the twelve-month clock disclosed on the form.
      purgeAfter:
        v.status === "declined"
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10)
          : null,
      updatedAt: new Date(),
    })
    .where(eq(enquiries.id, id));

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

  const enquiry = await db.query.enquiries.findFirst({
    where: eq(enquiries.id, enquiryId),
  });
  if (!enquiry) return { ok: false, error: "That enquiry no longer exists." };

  const run = await createRun({
    tool,
    enquiryId,
    childFirstName: enquiry.childFirstName,
    childAgeBand: enquiry.childAgeBand,
  });

  revalidatePath(`/teacher/enquiries/${enquiryId}`);
  return { ok: true, url: `/check/${run.token}` };
}
