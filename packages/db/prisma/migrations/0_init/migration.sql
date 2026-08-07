-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rumah" (
    "id" UUID NOT NULL,
    "nama" TEXT NOT NULL,
    "alamat" TEXT NOT NULL,
    "biaya_kos" INTEGER NOT NULL DEFAULT 0,
    "biaya_wifi" INTEGER NOT NULL DEFAULT 0,
    "biaya_listrik_wajib" INTEGER NOT NULL DEFAULT 0,
    "nominal_denda" INTEGER NOT NULL DEFAULT 50000,
    "rekening_bank" TEXT,
    "rekening_nomor" TEXT,
    "rekening_nama" TEXT,
    "qris_url" TEXT,
    "invite_code" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rumah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anggota" (
    "id" UUID NOT NULL,
    "rumah_id" UUID,
    "nama" TEXT NOT NULL,
    "foto_profil" TEXT,
    "kamar" TEXT,
    "kontak_darurat" TEXT,
    "alamat" TEXT,
    "role" TEXT NOT NULL DEFAULT 'anggota',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anggota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "undangan_kos" (
    "id" UUID NOT NULL,
    "rumah_id" UUID NOT NULL,
    "kode" TEXT NOT NULL,
    "dibuat_oleh" UUID NOT NULL,
    "expired_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "undangan_kos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jadwal" (
    "id" UUID NOT NULL,
    "rumah_id" UUID NOT NULL,
    "tanggal" DATE NOT NULL,
    "anggota_id" UUID NOT NULL,
    "ruangan" TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jadwal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekend_status" (
    "id" UUID NOT NULL,
    "anggota_id" UUID NOT NULL,
    "minggu_mulai" DATE NOT NULL,
    "hari" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "weekend_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ruangan" (
    "id" UUID NOT NULL,
    "rumah_id" UUID NOT NULL,
    "nama" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ruangan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jenis_piket" (
    "id" UUID NOT NULL,
    "ruangan_id" UUID NOT NULL,
    "nama" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "jenis_piket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "piket_submissions" (
    "id" UUID NOT NULL,
    "jadwal_id" UUID NOT NULL,
    "anggota_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'menunggu',
    "submitted_at" TIMESTAMPTZ,

    CONSTRAINT "piket_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ruangan_proof" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "ruangan_id" UUID NOT NULL,
    "foto_before" TEXT,
    "foto_after" TEXT,
    "jenis_selesai" TEXT[],

    CONSTRAINT "ruangan_proof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "piket_approval" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "reviewed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "piket_approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "denda" (
    "id" UUID NOT NULL,
    "anggota_id" UUID NOT NULL,
    "submission_id" UUID,
    "nominal" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'belum_bayar',
    "bayar_ke_anggota_id" UUID,
    "bukti_bayar" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "denda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pembayaran_approval" (
    "id" UUID NOT NULL,
    "denda_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pembayaran_approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iuran_bulanan" (
    "id" UUID NOT NULL,
    "anggota_id" UUID NOT NULL,
    "bulan" DATE NOT NULL,
    "kategori" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "nominal" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'belum_bayar',
    "bukti_bayar" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iuran_bulanan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pelunasan_bulanan" (
    "id" UUID NOT NULL,
    "rumah_id" UUID NOT NULL,
    "bulan" DATE NOT NULL,
    "kategori" TEXT NOT NULL,
    "bukti_lunas" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pelunasan_bulanan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pembayaran_listrik" (
    "id" UUID NOT NULL,
    "rumah_id" UUID NOT NULL,
    "anggota_id" UUID NOT NULL,
    "bulan" DATE NOT NULL,
    "nominal" INTEGER NOT NULL,
    "bukti_bayar" TEXT,
    "keterangan" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pembayaran_listrik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swap_requests" (
    "id" UUID NOT NULL,
    "dari_anggota_id" UUID NOT NULL,
    "ke_anggota_id" UUID NOT NULL,
    "tanggal" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'diajukan',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "giliran_galon" (
    "id" UUID NOT NULL,
    "rumah_id" UUID NOT NULL,
    "anggota_id" UUID NOT NULL,
    "periode_mulai" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'menunggu',
    "confirmed_at" TIMESTAMPTZ,

    CONSTRAINT "giliran_galon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fcm_tokens" (
    "id" UUID NOT NULL,
    "anggota_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fcm_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rumah_invite_code_key" ON "rumah"("invite_code");

-- CreateIndex
CREATE INDEX "anggota_rumah_id_idx" ON "anggota"("rumah_id");

-- CreateIndex
CREATE INDEX "undangan_kos_kode_idx" ON "undangan_kos"("kode");

-- CreateIndex
CREATE INDEX "jadwal_rumah_id_tanggal_idx" ON "jadwal"("rumah_id", "tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "weekend_status_anggota_id_minggu_mulai_hari_key" ON "weekend_status"("anggota_id", "minggu_mulai", "hari");

-- CreateIndex
CREATE INDEX "ruangan_rumah_id_urutan_idx" ON "ruangan"("rumah_id", "urutan");

-- CreateIndex
CREATE INDEX "jenis_piket_ruangan_id_idx" ON "jenis_piket"("ruangan_id");

-- CreateIndex
CREATE INDEX "piket_submissions_jadwal_id_idx" ON "piket_submissions"("jadwal_id");

-- CreateIndex
CREATE UNIQUE INDEX "ruangan_proof_submission_id_ruangan_id_key" ON "ruangan_proof"("submission_id", "ruangan_id");

-- CreateIndex
CREATE INDEX "piket_approval_submission_id_idx" ON "piket_approval"("submission_id");

-- CreateIndex
CREATE INDEX "denda_anggota_id_idx" ON "denda"("anggota_id");

-- CreateIndex
CREATE INDEX "pembayaran_approval_denda_id_idx" ON "pembayaran_approval"("denda_id");

-- CreateIndex
CREATE INDEX "iuran_bulanan_bulan_idx" ON "iuran_bulanan"("bulan");

-- CreateIndex
CREATE UNIQUE INDEX "iuran_bulanan_anggota_id_bulan_kategori_key" ON "iuran_bulanan"("anggota_id", "bulan", "kategori");

-- CreateIndex
CREATE UNIQUE INDEX "pelunasan_bulanan_rumah_id_bulan_kategori_key" ON "pelunasan_bulanan"("rumah_id", "bulan", "kategori");

-- CreateIndex
CREATE INDEX "pembayaran_listrik_rumah_id_bulan_idx" ON "pembayaran_listrik"("rumah_id", "bulan");

-- CreateIndex
CREATE INDEX "swap_requests_ke_anggota_id_idx" ON "swap_requests"("ke_anggota_id");

-- CreateIndex
CREATE UNIQUE INDEX "fcm_tokens_token_key" ON "fcm_tokens"("token");

-- AddForeignKey
ALTER TABLE "anggota" ADD CONSTRAINT "anggota_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anggota" ADD CONSTRAINT "anggota_rumah_id_fkey" FOREIGN KEY ("rumah_id") REFERENCES "rumah"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "undangan_kos" ADD CONSTRAINT "undangan_kos_rumah_id_fkey" FOREIGN KEY ("rumah_id") REFERENCES "rumah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal" ADD CONSTRAINT "jadwal_rumah_id_fkey" FOREIGN KEY ("rumah_id") REFERENCES "rumah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal" ADD CONSTRAINT "jadwal_anggota_id_fkey" FOREIGN KEY ("anggota_id") REFERENCES "anggota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekend_status" ADD CONSTRAINT "weekend_status_anggota_id_fkey" FOREIGN KEY ("anggota_id") REFERENCES "anggota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruangan" ADD CONSTRAINT "ruangan_rumah_id_fkey" FOREIGN KEY ("rumah_id") REFERENCES "rumah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jenis_piket" ADD CONSTRAINT "jenis_piket_ruangan_id_fkey" FOREIGN KEY ("ruangan_id") REFERENCES "ruangan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piket_submissions" ADD CONSTRAINT "piket_submissions_jadwal_id_fkey" FOREIGN KEY ("jadwal_id") REFERENCES "jadwal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piket_submissions" ADD CONSTRAINT "piket_submissions_anggota_id_fkey" FOREIGN KEY ("anggota_id") REFERENCES "anggota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruangan_proof" ADD CONSTRAINT "ruangan_proof_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "piket_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruangan_proof" ADD CONSTRAINT "ruangan_proof_ruangan_id_fkey" FOREIGN KEY ("ruangan_id") REFERENCES "ruangan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piket_approval" ADD CONSTRAINT "piket_approval_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "piket_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denda" ADD CONSTRAINT "denda_anggota_id_fkey" FOREIGN KEY ("anggota_id") REFERENCES "anggota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "denda" ADD CONSTRAINT "denda_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "piket_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembayaran_approval" ADD CONSTRAINT "pembayaran_approval_denda_id_fkey" FOREIGN KEY ("denda_id") REFERENCES "denda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iuran_bulanan" ADD CONSTRAINT "iuran_bulanan_anggota_id_fkey" FOREIGN KEY ("anggota_id") REFERENCES "anggota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pelunasan_bulanan" ADD CONSTRAINT "pelunasan_bulanan_rumah_id_fkey" FOREIGN KEY ("rumah_id") REFERENCES "rumah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembayaran_listrik" ADD CONSTRAINT "pembayaran_listrik_rumah_id_fkey" FOREIGN KEY ("rumah_id") REFERENCES "rumah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembayaran_listrik" ADD CONSTRAINT "pembayaran_listrik_anggota_id_fkey" FOREIGN KEY ("anggota_id") REFERENCES "anggota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_dari_anggota_id_fkey" FOREIGN KEY ("dari_anggota_id") REFERENCES "anggota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_ke_anggota_id_fkey" FOREIGN KEY ("ke_anggota_id") REFERENCES "anggota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "giliran_galon" ADD CONSTRAINT "giliran_galon_rumah_id_fkey" FOREIGN KEY ("rumah_id") REFERENCES "rumah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "giliran_galon" ADD CONSTRAINT "giliran_galon_anggota_id_fkey" FOREIGN KEY ("anggota_id") REFERENCES "anggota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fcm_tokens" ADD CONSTRAINT "fcm_tokens_anggota_id_fkey" FOREIGN KEY ("anggota_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

