DROP TABLE IF EXISTS "attendance" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "class_groups" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "class_session_materials" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "class_sessions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "enrollment_item_overrides" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "enrollments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "generated_documents" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "parent_notes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "reschedule_requests" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "scheduled_classes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "syllabus_week_items" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "syllabus_weeks" CASCADE;--> statement-breakpoint
ALTER TABLE "syllabi" ADD COLUMN "unit_label" text DEFAULT 'Week' NOT NULL;--> statement-breakpoint
ALTER TABLE "syllabi" ADD COLUMN "unit_label_plural" text DEFAULT 'Weeks' NOT NULL;