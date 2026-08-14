DROP INDEX "content_items_lookup_idx";--> statement-breakpoint
CREATE INDEX "content_items_lookup_idx" ON "content_items" USING btree ("type","status");--> statement-breakpoint
ALTER TABLE "content_items" DROP COLUMN "difficulty_level";--> statement-breakpoint
ALTER TABLE "content_items" DROP COLUMN "theme_tags";--> statement-breakpoint
ALTER TABLE "content_items" DROP COLUMN "grammar_tags";--> statement-breakpoint
ALTER TABLE "syllabi" DROP COLUMN "level";