-- Split `enquiries` into a family (keyed on the parent's email) and one row
-- per child.
--
-- Written by hand: drizzle-kit cannot tell a dropped column from a renamed
-- one without a TTY, and could not have generated the grouping below in any
-- case. The data is carried across rather than dropped — six rows today, but
-- the habit is what matters.

CREATE TABLE "enquiry_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_email" text NOT NULL,
	"parent_name" text,
	"whatsapp" text,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"loops_stage" text,
	"loops_synced_at" timestamp with time zone,
	"purge_after" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "enquiry_families_email_key" ON "enquiry_families" ("parent_email");
--> statement-breakpoint

-- One family per distinct address. DISTINCT ON picks the newest row's parent
-- details, which are the ones most likely to still be correct.
INSERT INTO "enquiry_families"
  ("parent_email", "parent_name", "whatsapp", "timezone",
   "loops_stage", "loops_synced_at", "purge_after", "created_at")
SELECT DISTINCT ON (lower("parent_email"))
  lower("parent_email"),
  "parent_name",
  "whatsapp",
  "timezone",
  "loops_stage",
  "loops_synced_at",
  "purge_after",
  "created_at"
FROM "enquiries"
WHERE "parent_email" IS NOT NULL
ORDER BY lower("parent_email"), "created_at" DESC;
--> statement-breakpoint

ALTER TABLE "enquiries" ADD COLUMN "family_id" uuid;
--> statement-breakpoint

UPDATE "enquiries" e
SET "family_id" = f."id"
FROM "enquiry_families" f
WHERE lower(e."parent_email") = f."parent_email";
--> statement-breakpoint

-- An enquiry with no email was never reachable and cannot belong to a family.
-- There are none today; this is here so the NOT NULL below cannot fail.
DELETE FROM "enquiries" WHERE "family_id" IS NULL;
--> statement-breakpoint

ALTER TABLE "enquiries" ALTER COLUMN "family_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_family_id_enquiry_families_id_fk"
  FOREIGN KEY ("family_id") REFERENCES "enquiry_families"("id") ON DELETE cascade;
--> statement-breakpoint

DROP INDEX IF EXISTS "enquiries_email_idx";
--> statement-breakpoint
CREATE INDEX "enquiries_family_idx" ON "enquiries" ("family_id");
--> statement-breakpoint

-- Now that every value is safely on the family, the copies go.
ALTER TABLE "enquiries" DROP COLUMN "parent_email";
--> statement-breakpoint
ALTER TABLE "enquiries" DROP COLUMN "parent_name";
--> statement-breakpoint
ALTER TABLE "enquiries" DROP COLUMN "whatsapp";
--> statement-breakpoint
ALTER TABLE "enquiries" DROP COLUMN "timezone";
--> statement-breakpoint
ALTER TABLE "enquiries" DROP COLUMN "loops_stage";
--> statement-breakpoint
ALTER TABLE "enquiries" DROP COLUMN "loops_synced_at";
--> statement-breakpoint
ALTER TABLE "enquiries" DROP COLUMN "purge_after";
