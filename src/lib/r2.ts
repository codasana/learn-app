import "server-only";

import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 — where slides, worksheets, images and audio live.
 *
 * R2 speaks the S3 API, so this is the AWS SDK pointed at Cloudflare's
 * endpoint. Two things differ from real S3 and both matter:
 *
 *  - `region` must be the literal string "auto". R2 has no regions in the S3
 *    sense; the bucket's location is fixed when it is created.
 *  - Files are read over a **public** base URL (an r2.dev subdomain today, a
 *    custom domain once the name is settled), not through this client. That is
 *    what puts them on Cloudflare's edge cache, so a family in Dubai is not
 *    fetching a 20MB deck from wherever the bucket happens to live.
 *
 * The client is created lazily, never at module load: build-time tooling that
 * merely imports this file has no runtime env vars and would bake in
 * `undefined`.
 *
 * PUBLIC BY DESIGN, WITH A LIMIT. Everything here is world-readable to anyone
 * holding the URL, which is correct for teaching material. It is NOT correct
 * for a child's own work or a report — those need signed reads from a private
 * bucket, and must not be dropped in here for convenience.
 */

let client: S3Client | null = null;

function r2() {
  if (!client) {
    const accountId = required("R2_ACCOUNT_ID");
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
      /*
       * Recent AWS SDK versions add a CRC32 checksum to every request by
       * default. That is fine when the SDK sends the body, and broken for a
       * presigned URL: the checksum is computed at signing time — over no body
       * at all — and baked into the signature. The browser then PUTs the real
       * bytes and the request fails, having already signed a promise about
       * content that did not exist yet.
       *
       * WHEN_REQUIRED keeps checksums for the operations that genuinely need
       * them and leaves presigned URLs alone.
       */
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }
  return client;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. File storage needs all five R2_* variables in .env.local.`,
    );
  }
  return value;
}

export function bucket(): string {
  return required("R2_BUCKET");
}

/** True when storage is configured, for UI that should degrade rather than throw. */
export function storageReady(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_BASE_URL,
  );
}

/* ------------------------------------------------------------------ */
/* Keys                                                                */
/* ------------------------------------------------------------------ */

/**
 * Where a file lives in the bucket.
 *
 * A uuid folder per upload rather than a flat namespace, so two teachers can
 * both upload "Week 1.pdf" and neither overwrites the other. The original
 * filename is kept as the last segment because it is what a browser offers as
 * the download name, and "Week 1 worksheet.pdf" is a great deal kinder to a
 * parent than a bare uuid.
 */
export function storageKey(folder: string, filename: string): string {
  return `${folder}/${randomUUID()}/${safeName(filename)}`;
}

/**
 * Filenames arrive from a file picker and go into a URL. Strip anything that
 * would break a path, escape oddly, or walk out of the folder.
 */
export function safeName(filename: string): string {
  const cleaned = filename
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ /g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\-]+/, "");

  return cleaned.slice(0, 120) || "file";
}

/** The URL a browser reads the file from. Edge-cached; never the S3 endpoint. */
export function publicUrl(key: string): string {
  const base = required("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */

export async function putObject(
  key: string,
  body: Uint8Array | Buffer | string,
  contentType: string,
): Promise<string> {
  await r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return key;
}

export async function deleteObject(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * A short-lived URL the browser can PUT straight to.
 *
 * Uploads go browser → R2 without passing through the app. A 40MB slide deck
 * has no business travelling through a serverless function with a request-size
 * limit and a timeout, and this keeps that whole class of problem away.
 */
export async function presignedUpload(
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  );
}

/** A short-lived read URL. Only needed if a bucket is ever made private. */
export async function presignedRead(
  key: string,
  expiresIn = 300,
): Promise<string> {
  return getSignedUrl(
    r2(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn },
  );
}
