/*
  Warnings:

  - You are about to drop the column `tanggal_ke` on the `swap_requests` table. All the data in the column will be lost.
  - Added the required column `tanggalKe` to the `swap_requests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "swap_requests" DROP COLUMN "tanggal_ke",
ADD COLUMN     "tanggalKe" DATE NOT NULL;

-- AddForeignKey
ALTER TABLE "piket_submissions" ADD CONSTRAINT "piket_submissions_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "anggota"("id") ON DELETE SET NULL ON UPDATE CASCADE;
