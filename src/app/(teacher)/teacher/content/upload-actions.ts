"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contentItems } from "@/db/schema";
import {
  deleteObject,
  presignedUpload,
  publicUrl,
  storageKey,
  storageReady,
} from "@/lib/r2";
import { requireTeacher } from "@/lib/session";

/**
 * Uploads go browser → R2 directly, using a URL signed here.
 *
 * The file never passes through the app. A 40MB slide deck has no business
 * travelling through a serverless function with a request-size cap and a
 * timeout, and routing around that whole class of problem costs one extra
 * round trip.
 *
 * Signing is gated on being a teacher, so the ability to write into the bucket
 * is never handed to anyone else.
 */

/** What a browser may upload, and what it may not. */
const ALLOWED: Record<string, string[]> = {
  slides: ["application/pdf"],
  worksheet: ["application/pdf"],
  image: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  audio: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/ogg"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  listening: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/ogg"],
};

/**
 * 100MB. Generous enough for a scanned worksheet or a long audio clip, low
 * enough that a mis-picked video does not quietly cost real money.
 */
const MAX_BYTES = 100 * 1024 * 1024;

export type SignResult =
  | { ok: true; uploadUrl: string; fileUrl: string; key: string }
  | { ok: false; error: string };

export async function signUpload(input: {
  type: string;
  filename: string;
  contentType: string;
  size: number;
}): Promise<SignResult> {
  await requireTeacher();

  if (!storageReady()) {
    return { ok: false, error: "File storage isn't set up yet." };
  }

  const allowed = ALLOWED[input.type];
  if (!allowed) {
    return { ok: false, error: "This kind of content doesn't take a file." };
  }
  if (!allowed.includes(input.contentType)) {
    return {
      ok: false,
      error:
        input.type === "slides" || input.type === "worksheet"
          ? "Please upload a PDF. Export it from PowerPoint or Word."
          : "That file type isn't supported here.",
    };
  }
  if (input.size > MAX_BYTES) {
    return { ok: false, error: "That file is bigger than 100MB." };
  }
  if (input.size <= 0) {
    return { ok: false, error: "That file appears to be empty." };
  }

  const key = storageKey(input.type, input.filename);
  const uploadUrl = await presignedUpload(key, input.contentType);

  return { ok: true, uploadUrl, fileUrl: publicUrl(key), key };
}

/** Records the uploaded file against an item that already exists. */
export async function attachFile(
  id: string,
  fileUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireTeacher();
  await db
    .update(contentItems)
    .set({ fileUrl, updatedAt: new Date() })
    .where(eq(contentItems.id, id));
  return { ok: true };
}

/**
 * Removes a file from the bucket.
 *
 * Storage failures are swallowed on purpose: if the object is already gone, or
 * R2 is briefly unreachable, the teacher's intent — "this file is no longer
 * part of this item" — should still be honoured. An orphaned object costs
 * fractions of a penny; a form that refuses to let go of a wrong file costs
 * her the afternoon.
 */
export async function removeFile(key: string): Promise<void> {
  await requireTeacher();
  try {
    await deleteObject(key);
  } catch {
    // Intentionally ignored — see above.
  }
}
