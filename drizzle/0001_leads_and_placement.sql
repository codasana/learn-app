CREATE TYPE "public"."lead_source" AS ENUM('tool', 'referral', 'direct', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'check_sent', 'check_done', 'session_booked', 'session_done', 'report_sent', 'enrolled', 'declined', 'dormant');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_name" text,
	"parent_email" text,
	"whatsapp" text,
	"child_first_name" text,
	"child_age_band" "age_band",
	"child_grade" integer,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"source" "lead_source" DEFAULT 'direct' NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"cal_booking_id" text,
	"session_at" timestamp with time zone,
	"suggested_level" integer,
	"final_level" integer,
	"teacher_notes" text,
	"notes" text,
	"purge_after" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "placement_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"token" text NOT NULL,
	"child_first_name" text,
	"child_age_band" "age_band",
	"responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"vocab_score" integer,
	"vocab_total" integer,
	"reading_score" integer,
	"reading_total" integer,
	"listening_score" integer,
	"listening_total" integer,
	"suggested_level" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "placement_attempts_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "placement_attempts" ADD CONSTRAINT "placement_attempts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_email_idx" ON "leads" USING btree ("parent_email");--> statement-breakpoint
CREATE INDEX "placement_attempts_lead_idx" ON "placement_attempts" USING btree ("lead_id");