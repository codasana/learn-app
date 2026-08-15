ALTER TABLE "enrollments" ADD COLUMN "slot_days" integer[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "slot_time" text;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "slot_timezone" text DEFAULT 'Asia/Kolkata' NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "duration_min" integer DEFAULT 45 NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "meeting_url" text;