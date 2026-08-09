-- AddForeignKey
ALTER TABLE "piket_approval" ADD CONSTRAINT "piket_approval_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "anggota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
