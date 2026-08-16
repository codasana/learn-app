-- Where a child came from, and the record that a parent agreed.
--
-- `from_enquiry_id` is intentionally NOT a foreign key: the funnel must stay
-- deletable without a migration reaching anything a child is learning from.
-- A dangling id is the correct behaviour for an audit trail of a record that
-- has since been purged.

ALTER TABLE "child_profiles" ADD COLUMN "from_enquiry_id" uuid;--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN "consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN "consent_version" text;--> statement-breakpoint
ALTER TABLE "child_profiles" ADD COLUMN "consent_note" text;--> statement-breakpoint
CREATE INDEX "child_profiles_from_enquiry_idx" ON "child_profiles" ("from_enquiry_id");
