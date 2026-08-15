"use server";

import { presignedUpload, storageKey, storageReady } from "@/lib/r2";
import { acceptedKinds } from "@/lib/content-types";
import { requireLearner, unitPractice } from "@/lib/child-session";

/**
 * Signing an upload for a CHILD.
 *
 * The teacher's equivalent lives in teacher/content/upload-actions.ts and is
 * gated on being a teacher. This one is deliberately separate and much
 * narrower rather than shared, because the two have almost nothing in common
 * beyond the word "upload":
 *
 *   - a teacher may upload against any content item; a child may only upload
 *     against an activity set for them, in their current unit, that says it
 *     accepts that shape of answer
 *   - a teacher's file becomes public; a child's recording never does
 *   - the size cap here is small, because it is one child talking
 *
 * Sharing a signer between the two would mean one `if (role === ...)` holding
 * the whole boundary. Two functions hold it structurally.
 */

const ALLOWED: Record<string, string[]> = {
  audio: ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav"],
  photo: ["image/png", "image/jpeg", "image/webp", "image/heic"],
};

/** 25MB — several minutes of a child talking, and nowhere near a video. */
const MAX_BYTES = 25 * 1024 * 1024;

export type SignResult =
  | { ok: true; uploadUrl: string; key: string }
  | { ok: false; error: string };

export async function signSubmissionUpload(input: {
  contentItemId: string;
  kind: "audio" | "photo";
  contentType: string;
  size: number;
}): Promise<SignResult> {
  const learner = await requireLearner();
  if (!storageReady()) {
    return { ok: false, error: "We can't take recordings just now." };
  }
  if (!learner.enrolment?.unitId) {
    return { ok: false, error: "That task isn't set for you." };
  }

  // Same check the submit action makes: the item must be in this child's
  // current unit. A signed upload URL is a write into the bucket, so it is
  // gated exactly as tightly as the submission itself.
  const items = await unitPractice(learner.enrolment.unitId);
  const item = items.find((i) => i.id === input.contentItemId);
  if (!item) return { ok: false, error: "That task isn't set for you." };

  if (!acceptedKinds(item.type).includes(input.kind)) {
    return { ok: false, error: "That isn't how this one is handed in." };
  }
  if (!ALLOWED[input.kind]?.includes(input.contentType)) {
    return { ok: false, error: "That didn't record properly. Try again." };
  }
  if (input.size <= 0 || input.size > MAX_BYTES) {
    return { ok: false, error: "That recording is too long to send." };
  }

  /*
   * The key is built here, never accepted from the browser, and it carries the
   * child's id — so one child can never write over another's work even if they
   * hand in against the same activity.
   */
  const ext = input.contentType.split("/")[1]?.split(";")[0] ?? "bin";
  const key = storageKey(
    "submissions",
    `${learner.childId}-${input.contentItemId}.${ext}`,
  );

  return { ok: true, uploadUrl: await presignedUpload(key, input.contentType), key };
}
