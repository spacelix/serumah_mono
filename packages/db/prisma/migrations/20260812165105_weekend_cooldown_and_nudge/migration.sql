-- AlterTable
ALTER TABLE "anggota" ADD COLUMN     "last_nudge_at" TIMESTAMPTZ;

-- Add column nullable first, backfill from created_at, then enforce NOT NULL
-- (existing weekend_status rows have no updated_at yet).
ALTER TABLE "weekend_status" ADD COLUMN "updated_at" TIMESTAMPTZ;
UPDATE "weekend_status" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
ALTER TABLE "weekend_status" ALTER COLUMN "updated_at" SET NOT NULL;
