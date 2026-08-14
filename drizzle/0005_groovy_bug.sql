ALTER TABLE "content_items" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
-- Carry the two old tag columns into the one that replaces them. Theme and
-- grammar were never really different kinds of thing — both were just words
-- the teacher wanted to find content by.
UPDATE "content_items" SET "tags" = "theme_tags" || "grammar_tags";
