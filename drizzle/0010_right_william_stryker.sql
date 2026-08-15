CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_class_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"status" "attendance_status" NOT NULL,
	"marked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"teacher_id" text,
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
	"syllabus_unit_id" uuid NOT NULL,
	"class_number" integer NOT NULL,
	"title" text NOT NULL,
	"plan_md" text,
	CONSTRAINT "class_session_unique" UNIQUE("syllabus_unit_id","class_number")
);
--> statement-breakpoint
CREATE TABLE "enrollment_item_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"syllabus_unit_id" uuid NOT NULL,
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
	"teacher_id" text,
	"start_date" date NOT NULL,
	"current_unit" integer DEFAULT 1 NOT NULL,
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
	"unit_position" integer NOT NULL,
	"body" text NOT NULL,
	"author_id" text,
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
	"syllabus_unit_id" uuid,
	"class_number" integer,
	"teacher_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_min" integer DEFAULT 45 NOT NULL,
	"meeting_url" text,
	"status" "scheduled_class_status" DEFAULT 'scheduled' NOT NULL,
	"teacher_recap_md" text
);
--> statement-breakpoint
CREATE TABLE "syllabus_unit_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"syllabus_unit_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "syllabus_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"syllabus_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"theme" text NOT NULL,
	"grammar_focus" text,
	CONSTRAINT "syllabus_unit_unique" UNIQUE("syllabus_id","position")
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_scheduled_class_id_scheduled_classes_id_fk" FOREIGN KEY ("scheduled_class_id") REFERENCES "public"."scheduled_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_session_materials" ADD CONSTRAINT "class_session_materials_class_session_id_class_sessions_id_fk" FOREIGN KEY ("class_session_id") REFERENCES "public"."class_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_session_materials" ADD CONSTRAINT "class_session_materials_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_syllabus_unit_id_syllabus_units_id_fk" FOREIGN KEY ("syllabus_unit_id") REFERENCES "public"."syllabus_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_item_overrides" ADD CONSTRAINT "enrollment_item_overrides_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_item_overrides" ADD CONSTRAINT "enrollment_item_overrides_syllabus_unit_id_syllabus_units_id_fk" FOREIGN KEY ("syllabus_unit_id") REFERENCES "public"."syllabus_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_item_overrides" ADD CONSTRAINT "enrollment_item_overrides_replaces_content_item_id_content_items_id_fk" FOREIGN KEY ("replaces_content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_item_overrides" ADD CONSTRAINT "enrollment_item_overrides_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_syllabus_id_syllabi_id_fk" FOREIGN KEY ("syllabus_id") REFERENCES "public"."syllabi"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_group_id_class_groups_id_fk" FOREIGN KEY ("class_group_id") REFERENCES "public"."class_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_notes" ADD CONSTRAINT "parent_notes_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_notes" ADD CONSTRAINT "parent_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_scheduled_class_id_scheduled_classes_id_fk" FOREIGN KEY ("scheduled_class_id") REFERENCES "public"."scheduled_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_classes" ADD CONSTRAINT "scheduled_classes_class_group_id_class_groups_id_fk" FOREIGN KEY ("class_group_id") REFERENCES "public"."class_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_classes" ADD CONSTRAINT "scheduled_classes_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_classes" ADD CONSTRAINT "scheduled_classes_syllabus_unit_id_syllabus_units_id_fk" FOREIGN KEY ("syllabus_unit_id") REFERENCES "public"."syllabus_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_classes" ADD CONSTRAINT "scheduled_classes_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_unit_items" ADD CONSTRAINT "syllabus_unit_items_syllabus_unit_id_syllabus_units_id_fk" FOREIGN KEY ("syllabus_unit_id") REFERENCES "public"."syllabus_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_unit_items" ADD CONSTRAINT "syllabus_unit_items_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "syllabus_units" ADD CONSTRAINT "syllabus_units_syllabus_id_syllabi_id_fk" FOREIGN KEY ("syllabus_id") REFERENCES "public"."syllabi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_materials_session_idx" ON "class_session_materials" USING btree ("class_session_id");--> statement-breakpoint
CREATE INDEX "enrollments_child_idx" ON "enrollments" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "enrollments_status_idx" ON "enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scheduled_classes_starts_idx" ON "scheduled_classes" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "syllabus_unit_items_unit_idx" ON "syllabus_unit_items" USING btree ("syllabus_unit_id");