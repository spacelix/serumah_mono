-- Drop kolom kamar dari tabel anggota — ruangan yang dibersihkan diatur
-- via Ruangan/JenisPiket pada jadwal, bukan profil anggota.
ALTER TABLE "anggota" DROP COLUMN IF EXISTS "kamar";
