ALTER TABLE "generated_documents" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."document_kind";--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('certificate', 'term_report', 'midterm_report', 'check_report', 'achievement_card', 'share_card');--> statement-breakpoint
ALTER TABLE "generated_documents" ALTER COLUMN "kind" SET DATA TYPE "public"."document_kind" USING "kind"::"public"."document_kind";