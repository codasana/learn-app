/**
 * Puts a CORS policy on the R2 bucket so browsers may upload straight to it.
 *
 *   npx tsx scripts/setup-r2-cors.ts
 *
 * Without this every direct upload dies at the preflight with "No
 * 'Access-Control-Allow-Origin' header" — the bucket is perfectly happy to
 * take the file, the browser just refuses to send it.
 *
 * Run again whenever the set of origins changes; it replaces the whole policy
 * rather than adding to it.
 */
import { createRequire } from "node:module";

import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "dotenv";

config({ path: ".env.local" });

const nodeRequire = createRequire(import.meta.url);
const Module = nodeRequire("node:module") as {
  _load: (req: string, parent: unknown, isMain: boolean) => unknown;
};
const load = Module._load;
Module._load = (req, parent, isMain) =>
  req === "server-only" ? {} : load(req, parent, isMain);

/**
 * Only origins we actually serve from.
 *
 * A wildcard would work and is what most tutorials reach for, but the presigned
 * URL is the security boundary here and there is no reason to let any site on
 * the internet make preflighted requests to the bucket. Add the real domain
 * here when it exists.
 */
const ORIGINS = [
  "http://localhost:3000",
  ...(process.env.NEXT_PUBLIC_APP_URL &&
  process.env.NEXT_PUBLIC_APP_URL !== "http://localhost:3000"
    ? [process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")]
    : []),
];

async function main() {
  const { bucket } = await import("../src/lib/r2");

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket(),
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ORIGINS,
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["content-type"],
            ExposeHeaders: ["etag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );

  console.log(`CORS set on "${bucket()}" for:`);
  for (const o of ORIGINS) console.log(`  ${o}`);
}

main().catch((err) => {
  console.error("\nCould not set CORS:", err?.name ?? err);
  console.error(
    "\nIf this is an access error, the R2 API token needs bucket-level\n" +
      "permission, not just Object Read & Write. Either create a token with\n" +
      "Admin Read & Write, or set CORS by hand in the dashboard:\n" +
      "  R2 → your bucket → Settings → CORS policy\n",
  );
  process.exit(1);
});
