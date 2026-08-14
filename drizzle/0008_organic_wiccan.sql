CREATE TYPE "public"."enquiry_source" AS ENUM('tool', 'demo_form', 'referral', 'other');--> statement-breakpoint
CREATE TYPE "public"."enquiry_status" AS ENUM('new', 'class_scheduled', 'class_done', 'report_sent', 'enrolled', 'declined', 'dormant');--> statement-breakpoint
CREATE TYPE "public"."tool_kind" AS ENUM('level_check');--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_name" text,
	"parent_email" text,
	"whatsapp" text,
	"child_first_name" text,
	"child_age_band" "age_band",
	"child_grade" integer,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"source" "enquiry_source" DEFAULT 'demo_form' NOT NULL,
	"status" "enquiry_status" DEFAULT 'new' NOT NULL,
	"cal_booking_id" text,
	"class_at" timestamp with time zone,
	"suggested_level" integer,
	"starting_level" integer,
	"teacher_notes" text,
	"notes" text,
	"purge_after" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tool" "tool_kind" NOT NULL,
	"enquiry_id" uuid,
	"token" text NOT NULL,
	"child_first_name" text,
	"child_age_band" "age_band",
	"responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "tool_runs_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "tool_runs" ADD CONSTRAINT "tool_runs_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enquiries_status_idx" ON "enquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "enquiries_email_idx" ON "enquiries" USING btree ("parent_email");--> statement-breakpoint
CREATE INDEX "tool_runs_enquiry_idx" ON "tool_runs" USING btree ("enquiry_id");--> statement-breakpoint
CREATE INDEX "tool_runs_tool_idx" ON "tool_runs" USING btree ("tool","completed_at");