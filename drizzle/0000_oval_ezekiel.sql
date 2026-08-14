CREATE TYPE "public"."activity_kind" AS ENUM('reading', 'listening', 'sentence_builder', 'quiz');--> statement-breakpoint
CREATE TYPE "public"."age_band" AS ENUM('8_9', '10_11', 'any');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."audience" AS ENUM('teacher', 'student', 'parent');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('passage', 'slides', 'worksheet', 'image', 'audio', 'video', 'activity', 'vocab_set', 'quiz', 'sentence_builder', 'listening', 'writing_task');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('certificate', 'term_report', 'midterm_report', 'placement_report', 'achievement_card', 'share_card');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'completed', 'paused', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."publish_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."release_rule" AS ENUM('before', 'during', 'after', 'never');--> statement-breakpoint
CREATE TYPE "public"."reschedule_status" AS ENUM('pending', 'approved', 'declined');--> statement-breakpoint
CREATE TYPE "public"."scheduled_class_status" AS ENUM('scheduled', 'completed', 'cancelled', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('parent', 'teacher', 'owner');--> statement-breakpoint
CREATE TYPE "public"."writing_status" AS ENUM('submitted', 'ai_drafted', 'released', 'redrafted');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"threshold" integer,
	"card_url" text,
	"earned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "achievement_unique" UNIQUE("child_id","kind","threshold")
);
--> statement-breakpoint
CREATE TABLE "activity_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"kind" "activity_kind" NOT NULL,
	"content_item_id" uuid,
	"score" integer,
	"total" integer,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_class_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"status" "attendance_status" NOT NULL,
	"marked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"word_key" text NOT NULL,
	"source_item_id" uuid,
	"box" integer DEFAULT 1 NOT NULL,
	"due_date" date NOT NULL,
	"correct_streak" integer DEFAULT 0 NOT NULL,
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"total_correct" integer DEFAULT 0 NOT NULL,
	"is_mastered" boolean DEFAULT false NOT NULL,
	"last_reviewed_at" timestamp,
	CONSTRAINT "card_states_child_word_unique" UNIQUE("child_id","word_key")
);
--> statement-breakpoint
CREATE TABLE "child_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" text NOT NULL,
	"first_name" text NOT NULL,
	"avatar" text DEFAULT 'fox' NOT NULL,
	"age_band" "age_band" DEFAULT '8_9' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"meeting_url" text,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_session_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_session_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"audience_override" "audience",
	"release" "release_rule" DEFAULT 'during' NOT NULL,
	"is_revealed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"syllabus_week_id" uuid NOT NULL,
	"class_number" integer NOT NULL,
	"title" text NOT NULL,
	"plan_md" text,
	CONSTRAINT "class_session_unique" UNIQUE("syllabus_week_id","class_number")
);
--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "content_type" NOT NULL,
	"title" text NOT NULL,
	"difficulty_level" integer NOT NULL,
	"age_band" "age_band" DEFAULT 'any' NOT NULL,
	"theme_tags" text[] DEFAULT '{}' NOT NULL,
	"grammar_tags" text[] DEFAULT '{}' NOT NULL,
	"audience" "audience" DEFAULT 'student' NOT NULL,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"body" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"file_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"date" date NOT NULL,
	"vocab_done" boolean DEFAULT false NOT NULL,
	"activities_done" integer DEFAULT 0 NOT NULL,
	"today_completed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "daily_progress_child_date_unique" UNIQUE("child_id","date")
);
--> statement-breakpoint
CREATE TABLE "enrollment_item_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"syllabus_week_id" uuid NOT NULL,
	"replaces_content_item_id" uuid,
	"content_item_id" uuid NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"syllabus_id" uuid NOT NULL,
	"class_group_id" uuid,
	"start_date" date NOT NULL,
	"current_week" integer DEFAULT 1 NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid,
	"enrollment_id" uuid,
	"kind" "document_kind" NOT NULL,
	"automette_template_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"file_url" text,
	"is_released" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reschedule_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_class_id" uuid NOT NULL,
	"requested_by" text NOT NULL,
	"proposed_starts_at" timestamp with time zone NOT NULL,
	"reason" text,
	"status" "reschedule_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "scheduled_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_group_id" uuid,
	"enrollment_id" uuid,
	"syllabus_week_id" uuid,
	"class_number" integer,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_min" integer DEFAULT 45 NOT NULL,
	"meeting_url" text,
	"status" "scheduled_class_status" DEFAULT 'scheduled' NOT NULL,
	"teacher_recap_md" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "syllabi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" integer NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syllabus_week_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"syllabus_week_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syllabus_weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"syllabus_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"theme" text NOT NULL,
	"grammar_focus" text,
	CONSTRAINT "syllabus_week_unique" UNIQUE("syllabus_id","week_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" "user_role" DEFAULT 'parent' NOT NULL,
	"pin_hash" text,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"whatsapp" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "writing_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"writing_task_id" uuid NOT NULL,
	"body" text,
	"photo_url" text,
	"planning_notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "writing_status" DEFAULT 'submitted' NOT NULL,
	"ai_draft" text,
	"teacher_feedback" text,
	"teacher_voice_url" text,
	"redraft_body" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"released_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_completions" ADD CONSTRAINT "activity_completions_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_completions" ADD CONSTRAINT "activity_completions_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_scheduled_class_id_scheduled_classes_id_fk" FOREIGN KEY ("scheduled_class_id") REFERENCES "public"."scheduled_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_states" ADD CONSTRAINT "card_states_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_states" ADD CONSTRAINT "card_states_source_item_id_content_items_id_fk" FOREIGN KEY ("source_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_session_materials" ADD CONSTRAINT "class_session_materials_class_session_id_class_sessions_id_fk" FOREIGN KEY ("class_session_id") REFERENCES "public"."class_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_session_materials" ADD CONSTRAINT "class_session_materials_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_syllabus_week_id_syllabus_weeks_id_fk" FOREIGN KEY ("syllabus_week_id") REFERENCES "public"."syllabus_weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_progress" ADD CONSTRAINT "daily_progress_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_item_overrides" ADD CONSTRAINT "enrollment_item_overrides_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_item_overrides" ADD CONSTRAINT "enrollment_item_overrides_syllabus_week_id_syllabus_weeks_id_fk" FOREIGN KEY ("syllabus_week_id") REFERENCES "public"."syllabus_weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_item_overrides" ADD CONSTRAINT "enrollment_item_overrides_replaces_content_item_id_content_items_id_fk" FOREIGN KEY ("replaces_content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_item_overrides" ADD CONSTRAINT "enrollment_item_overrides_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_syllabus_id_syllabi_id_fk" FOREIGN KEY ("syllabus_id") REFERENCES "public"."syllabi"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_group_id_class_groups_id_fk" FOREIGN KEY ("class_group_id") REFERENCES "public"."class_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_notes" ADD CONSTRAINT "parent_notes_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_scheduled_class_id_scheduled_classes_id_fk" FOREIGN KEY ("scheduled_class_id") REFERENCES "public"."scheduled_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_classes" ADD CONSTRAINT "scheduled_classes_class_group_id_class_groups_id_fk" FOREIGN KEY ("class_group_id") REFERENCES "public"."class_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_classes" ADD CONSTRAINT "scheduled_classes_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_classes" ADD CONSTRAINT "scheduled_classes_syllabus_week_id_syllabus_weeks_id_fk" FOREIGN KEY ("syllabus_week_id") REFERENCES "public"."syllabus_weeks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_week_items" ADD CONSTRAINT "syllabus_week_items_syllabus_week_id_syllabus_weeks_id_fk" FOREIGN KEY ("syllabus_week_id") REFERENCES "public"."syllabus_weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_week_items" ADD CONSTRAINT "syllabus_week_items_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_weeks" ADD CONSTRAINT "syllabus_weeks_syllabus_id_syllabi_id_fk" FOREIGN KEY ("syllabus_id") REFERENCES "public"."syllabi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writing_submissions" ADD CONSTRAINT "writing_submissions_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writing_submissions" ADD CONSTRAINT "writing_submissions_writing_task_id_content_items_id_fk" FOREIGN KEY ("writing_task_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_completions_child_idx" ON "activity_completions" USING btree ("child_id","completed_at");--> statement-breakpoint
CREATE INDEX "card_states_due_idx" ON "card_states" USING btree ("child_id","due_date");--> statement-breakpoint
CREATE INDEX "child_profiles_parent_idx" ON "child_profiles" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "class_materials_session_idx" ON "class_session_materials" USING btree ("class_session_id");--> statement-breakpoint
CREATE INDEX "content_items_lookup_idx" ON "content_items" USING btree ("type","difficulty_level","status");--> statement-breakpoint
CREATE INDEX "enrollments_child_idx" ON "enrollments" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "enrollments_status_idx" ON "enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scheduled_classes_starts_idx" ON "scheduled_classes" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "syllabus_week_items_week_idx" ON "syllabus_week_items" USING btree ("syllabus_week_id");--> statement-breakpoint
CREATE INDEX "writing_submissions_status_idx" ON "writing_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "writing_submissions_child_idx" ON "writing_submissions" USING btree ("child_id");