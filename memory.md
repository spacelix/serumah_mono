# Memory — Serumah: Weekend order + cooldown 6 jam + nudge galon 1x/hari + cleanup demo + profil darurat wajib + v1.9.5 (2026-08-12)

Last updated: 2026-08-12

## What was built (sesi ini)

**Committed (3, sinkron `origin/development`):**
- `856237b` **feat(weekend/galon):** cooldown 6 jam, nudge galon 1x/hari, weekend card responsif.
- `621d8c7` **chore:** bump v1.9.5 (versionCode 20).
- `766a2c8` **chore(db):** script cleanup-demo — hapus semua data rumah demo + user demo.

**Belum di-commit (onboarding profil darurat wajib):**
- `apps/mobile/src/app/onboarding/profile.tsx`: `kontakDarurat` + `alamat` **wajib** — label "No. telepon darurat"/"Alamat darurat", placeholder tanpa "(opsional)", button "Lanjut" disabled sampai terisi, validasi alert per field, kirim tanpa `|| undefined`.
- `context/features/onboarding/context.md` + `context/progress/progress-tracker.md`: keputusan locked.

### Weekend scheduling — urut berdasarkan waktu memilih
- `WeekendStatus.createdAt` (migrasi `20260812163456_weekend_status_created_at`) — `ensureWeekendWeek` urut di_kos **berdasar urutan memilih** (createdAt asc), bukan pemilik weekday. Assign bergantian: pilih pertama → Sabtu, kedua → Minggu, ketiga → Sabtu (tumpuk). Helper `weekdayOwnerDay` (dead code) dihapus.

### Cooldown ganti status weekend 6 jam (locked)
- `WeekendStatus.updatedAt` (migrasi `20260812165105_weekend_cooldown_and_nudge`).
- `setWeekendStatus` tolak `400` jika <6 jam sejak perubahan terakhir → "Tunggu X menit lagi untuk ganti." Helper `lastWeekendStatusChange`.
- Dashboard `GET /dashboard` expose `weekend.nextChangeAt` (ISO; null bila tak dalam cooldown).

### Nudge galon maks 1x/hari WIB (locked)
- `Anggota.lastNudgeAt` (migrasi sama). `POST /galon/nudge` tolak `409` "Kamu udah colek galon hari ini." + set; reset tengah malam WIB (helper `isTodayWib`).
- `currentFromAnggota` (galon + dashboard) expose `nudgedToday`.

### WeekendCard responsif (mobile)
- `index.tsx`: `useSetWeekendStatus` punya `onError` → ConfirmDialog "Gagal ubah status" (root cause bug "tidak responsif": error server senyap). Tombol pressed-state.
- Cooldown: tombol disable saat `nextChangeAt` masih depan + hint "Ganti status lagi pukul HH:MM WIB".
- **Layout fix tombol Pulang terpotong di HP fisik:** label `flex: 1, minWidth: 0` (truncate `numberOfLines={1}`), tombol `flexShrink: 0`. User memilih **tetap satu baris** label (`Sab, 15 Agu & Min, 16 Agu`), bukan 2 baris.
- `dashboard.ts` mobile: tipe `WeekendInfo.nextChangeAt`, `GalonInfo.nudgedToday`, hook `useNudgeGalon`.

### Cleanup demo DB
- `packages/db/src/cleanup-demo.ts` + script `db:cleanup:demo`. Hapus rumah "Kos Demo" (`00000000-0000-0000-0000-0000000d0000`) + user demo (`...0d0001/2/3`) + semua jadwal/proofs/denda/swap/iuran/galon/rooms/undangan **berurutan** (schema tanpa cascade). **Sudah dijalankan** ke DB server — terverifikasi bersih.

## Decisions made
- **Cooldown weekend = 6 jam** (user pilih).
- **Nudge reset = tengah malam WIB** (hari kalender, bukan sliding 24 jam).
- Weekend label card **tetap satu baris**.
- **Profil darurat wajib di onboarding, TANPA reminder modal di Beranda** (user pilih hapus modal — onboarding satu-satunya gerbang; tidak ada `profileIncomplete` di dashboard).
- Tag v1.9.5 = version bump commit `621d8c7` (konvensi repo).
- Push dari **Windows** (SSH key tidak tersedia di WSL).

## Problems solved
- **Weekend card "tidak responsif":** mutation tanpa `onError` → error server (403/400) senyap → tombol terasa mati. Fix: onError + ConfirmDialog.
- **Tombol Pulang tertutup di HP fisik:** label tak punya flex → mendorong tombol keluar. Fix `flex:1/minWidth:0` label + `flexShrink:0` tombol.
- **Migrasi `updated_at` NOT NULL gagal di tabel berisi data:** tambah kolom nullable → `UPDATE ... SET updated_at = created_at` → `SET NOT NULL`.
- **Schema tanpa cascade** → cleanup harus hapus tabel anak dulu (pembayaranApproval via denda, proofs/approval via submission, dll).

## Current state
- v1.9.5 (versionCode 20), tag annotated `v1.9.5` di `621d8c7`. **Tag BELUM di-push ke remote.**
- 3 commit push ke `origin/development`. Migrasi `..._created_at` + `..._cooldown_and_nudge` sudah di-apply ke DB server (43.129.40.34).
- **Backend VPS belum di-redeploy** dengan kode terbaru (cooldown/nudge/dashboard shape).
- **Onboarding profil darurat wajib UNCOMMITTED** — hanya typecheck yang dijalankan (API + mobile hijau), build/lint/test final belum.
- Rumah demo di server bersih; seed demo bisa dijalankan ulang (`bun run db:seed:demo`).

## Next session starts with
1. **Verifikasi build** onboarding wajib (serahkan ke user): `bun run build lint typecheck test --filter=@serumah/api` + mobile lint/typecheck/test. Setelah green → commit item onboarding.
2. **Push tag**: `git push origin v1.9.5` (dari Windows) → trigger GitHub Actions build APK.
3. **Redeploy backend VPS** (pull `development`, `docker compose up -d --build`, migrate prod).
4. Verifikasi HP fisik: cooldown weekend, nudge galon 1x/hari, tombol Pulang tidak terpotong, onboarding wajib.

## Open questions
- Test loop in-app update v1.9.4 → v1.9.5 belum dijalankan.
- Progress-tracker M5 checkbox belum ditandai selesai penuh.
