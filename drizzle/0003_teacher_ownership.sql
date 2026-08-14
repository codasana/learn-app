CREATE TYPE "public"."content_scope" AS ENUM('central', 'private');--> statement-breakpoint
ALTER TABLE "class_groups" ADD COLUMN "teacher_id" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "scope" "content_scope" DEFAULT 'central' NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "teacher_id" text;--> statement-breakpoint
ALTER TABLE "parent_notes" ADD COLUMN "author_id" text;--> statement-breakpoint
ALTER TABLE "scheduled_classes" ADD COLUMN "teacher_id" text;--> statement-breakpoint
ALTER TABLE "syllabi" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "syllabi" ADD COLUMN "scope" "content_scope" DEFAULT 'central' NOT NULL;--> statement-breakpoint
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_notes" ADD CONSTRAINT "parent_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_classes" ADD CONSTRAINT "scheduled_classes_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;