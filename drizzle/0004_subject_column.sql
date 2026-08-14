CREATE TYPE "public"."subject" AS ENUM('english');--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "subject" "subject" DEFAULT 'english' NOT NULL;--> statement-breakpoint
ALTER TABLE "syllabi" ADD COLUMN "subject" "subject" DEFAULT 'english' NOT NULL;