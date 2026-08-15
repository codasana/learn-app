CREATE TYPE "public"."submission_kind" AS ENUM('text', 'audio', 'photo', 'file', 'answers');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('submitted', 'ai_drafted', 'released', 'redrafted');--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"kind" "submission_kind" DEFAULT 'text' NOT NULL,
	"body" text,
	"media_url" text,
	"media_seconds" integer,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "submission_status" DEFAULT 'submitted' NOT NULL,
	"ai_draft" text,
	"teacher_feedback" text,
	"teacher_voice_url" text,
	"redraft_body" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"released_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_child_id_child_profiles_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "submissions_child_idx" ON "submissions" USING btree ("child_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_child_item_key" ON "submissions" USING btree ("child_id","content_item_id");--> statement-breakpoint
/*
 * Carry the existing writing across rather than losing it.
 *
 * A writing submission is exactly a submission whose answer happened to be
 * prose, so the rows map one to one. `photo_url` becomes `media_url`, and a
 * row that only ever had a photo is recorded as the photo it was.
 *
 * DISTINCT ON guards the new unique index: nothing should have made two rows
 * for one child and one task, but the old table had no constraint saying so,
 * and a migration is a bad place to discover otherwise.
 */
INSERT INTO "submissions" (
  "id", "child_id", "content_item_id", "kind", "body", "media_url",
  "notes", "status", "ai_draft", "teacher_feedback", "teacher_voice_url",
  "redraft_body", "submitted_at", "released_at"
)
SELECT DISTINCT ON ("child_id", "writing_task_id")
  "id",
  "child_id",
  "writing_task_id",
  CASE
    WHEN "body" IS NULL AND "photo_url" IS NOT NULL THEN 'photo'
    ELSE 'text'
  END::"submission_kind",
  "body",
  "photo_url",
  "planning_notes",
  "status"::text::"submission_status",
  "ai_draft",
  "teacher_feedback",
  "teacher_voice_url",
  "redraft_body",
  "submitted_at",
  "released_at"
FROM "writing_submissions"
ORDER BY "child_id", "writing_task_id", "submitted_at" DESC;
--> statement-breakpoint
DROP TABLE "writing_submissions" CASCADE;--> statement-breakpoint
DROP TYPE "public"."writing_status";
