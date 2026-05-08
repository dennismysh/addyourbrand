-- Drop the old `design` columns from 0000_init that don't fit the
-- preservation-mode flow, then add the columns the new flow needs.
-- Production's `design` table is empty so NOT NULL columns can be added
-- without defaults.

ALTER TABLE "design" DROP COLUMN IF EXISTS "analysis";
--> statement-breakpoint
ALTER TABLE "design" DROP COLUMN IF EXISTS "outputBlobKey";
--> statement-breakpoint
ALTER TABLE "design" ADD COLUMN "title" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "design" ADD COLUMN "templateContentType" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "design" ADD COLUMN "doc" jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "design" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;
