-- AddForeignKey
ALTER TABLE "denda" ADD COLUMN "reviewer_id" UUID;

-- AddForeignKey
ALTER TABLE "iuran_bulanan" ADD COLUMN "reviewer_id" UUID;

-- AddForeignKey
ALTER TABLE "denda" ADD CONSTRAINT "denda_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "anggota"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iuran_bulanan" ADD CONSTRAINT "iuran_bulanan_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "anggota"("id") ON DELETE SET NULL ON UPDATE CASCADE;
