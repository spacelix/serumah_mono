-- AlterTable
ALTER TABLE "anggota" ADD COLUMN "push_token" TEXT,
ADD COLUMN "push_token_updated_at" TIMESTAMPTZ;
