# Memory — Serumah: Build lokal fix + revisi UI swap + notifikasi weekend + CLI test push (2026-08-11)

Last updated: 2026-08-11

## What was built (sesi ini)

**Semua committed & di-push ke `development` via SSH (`git@github.com:spacelix/serumah_mono.git`).**

- `c108cc2` **feat v1.9.0** — revisi UI swap + notifikasi weekend + CLI test push + notification icon all-white.
- `3f6ac82` **ci:** install CMake 3.30.5 di `release.yml` (dibutuhkan `expo-build-properties` cmakeVersion).
- `ef73fc4` **fix(api):** exclude `scripts/` dari `tsconfig.build.json` — `dist/main.js` kembali flattened (Docker CMD `node dist/main`).

### Swap (`apps/mobile/src/app/(tabs)/swap.tsx` + `apps/api/src/modules/swap/`)
- Form **3 langkah** (sebelumnya 2): pilih hari lo (kartu tanggal + daftar **ruangan**, bukan jenis piket) → pilih hari anggota lain → ringkasan "LO KASIH ⇄ LO AMBIL" + "Kirim ke {nama}"/"Ubah". Klik kartu langsung lanjut step.
- **Swap hanya 1 minggu berjalan** (Sen–Min, hari ≥ hari ini) — `mondayOf(today)` +6, bukan 2 minggu.
- **Histori swap kompak** (`Jum, 18 Jul · piket asli X → dikerjain Y` + `Diterima Y · 16 Jul 21:04`) — pakai `resolvedAt` (kolom baru, migrasi `20260810174332_swap_resolved_at`, set saat accept/reject).
- **Filter bulan** di histori (default bulan berjalan, chevron `‹›` + sheet "Pilih bulan", nonaktif di ujung). Bar selalu tampil.
- `DayBox` pakai **nama depan** (`firstName` di `lib/format.ts`).
- Panah `⇄` jadi teks Space Grotesk (bukan lucide). Seed swap ditambah 4 request (incoming + history).

### UI umum
- **Welcome screen** (`(auth)/welcome.tsx`): auto-advance 3.5s/step, indicator = segmen aktif progress bar + dot untuk lainnya (selesai juga jadi dot), step terakhir STUCK (tidak auto ke login), transisi fade+slide naik.
- **`components/ui/animated-sheet.tsx`** (baru): reusable bottom sheet — backdrop fade-in + sheet rise (pola confirm-dialog, `useNativeDriver`). Dipakai di filter bulan tagihan & swap.
- Semua bottom sheet diberi `paddingBottom: insets.bottom + 26` (fix konten tertutup nav bar Android): denda detail, review piket, detail anggota, upload iuran, listrik, swap form.
- **Kicker subscreen** (`components/ui/screen-header.tsx`) = **nama rumah** (sebelumnya "Serumah").
- Fix `flex: 1` di tombol form swap (collaps ke 0 tinggi saat anak langsung sheet).
- Fix require cycle: `auth-store → notifications → api-client → auth-store` — `clearPushToken` jadi dynamic import di `auth-store.ts`.
- Format jam `19.00` → `19:00` (`formatDateTimeShort` di `lib/format.ts`).

### Notifikasi weekend (baru, belum di-test)
- `NotificationsService`: `notifyWeekendStatus` (ke semua anggota lain saat pilih Di kos/Pulang), `notifyWeekendReminder` (Jumat), `notifyWeekendMissed` (freeze).
- `schedule.service.ts`: hook notif di `setWeekendStatus`; `freezeWeekendCron` kirim "bertanggung jawab sepenuhnya" ke yang belum pilih sama sekali.
- `notifications-cron.service.ts`: cron **Jumat 08:00 + 19:00** reminder belum pilih (konsisten dgn freeze Jumat 20:00).
- **CLI test push** `apps/api/scripts/send-notification.ts` (`bun run notif:test`): pilih rumah wajib → pilih skenario (8 opsi) → pilih anggota (indikator token ●/○) → kirim via Expo. Load `.env` manual (`scripts/lib/env.ts`, import pertama — tanpa dotenv, override selalu).

### Notification icon
- `assets/images/notification-icon.png` = siluet **all-white** dari `splash-icon.png` (di-konversi, splash-icon punya warna jadi tidak valid langsung). Config `expo-notifications` di app.json: `icon` + `color: #EFEAE0`.

## Decisions made
- **E2E M6 = hybrid**: iterasi ke backend **lokal** dulu, **VPS** untuk final verification (push, cron, migrate prod). Backend VPS belum punya kode notifikasi — harus redeploy.
- **Tidak perlu seed dinamis** — app pribadi, tidak public (keputusan user, M6).
- Remote SSH permanen (`git@github.com`); push dilakukan dari **Windows** (SSH key tidak tersedia di WSL sandbox).
- Build lokal Windows butuh CMake **3.30.5** (via `expo-build-properties`) — CMake 3.22.1 punya bug `build.ninja still dirty`.
- Expo Go / emulator tidak bisa push Android — test push hanya di **device fisik**.

## Problems solved
- `build.ninja still dirty after 100 tries` (Windows): bukan path — root cause CMake 3.22.1 + bun `.bun` store. Fix: `android.cmakeVersion=3.30.5` (install via sdkmanager) + hapus `.cxx` stale. CI juga butuh `sdkmanager "cmake;3.30.5"` di release.yml.
- `PluginError expo-build-properties PLUGIN_NOT_FOUND` di Windows: bun membuat junction target-relatif `../../../` yang di Windows dihitung dari root drive (`D:\`) → node tidak resolve. Fix: `rm` junction + `mklink /J` dengan target **absolut**.
- `dist/main` tidak ditemukan di Docker: `scripts/send-notification.ts` ikut dikompilasi `nest build` → output jadi `dist/src/main.js`. Fix: exclude `scripts/` di `tsconfig.build.json`.
- Tombol swap tak berteks/hilang: (1) disabled text `paper` di `disabledBg` tak terlihat; (2) `flex:1` → tinggi 0 saat anak langsung sheet.
- `Invalid time value` di swap: API `available-days` masih return `string[]` lama — perlu restart API (shape baru `{tanggal, ruangan}`).
- Dashboard jadwal tak update setelah swap diterima: `SwapService.accept` tidak invalidate cache `dashboard:{rumahId}` — tambah `CacheService.invalidateScope`.

## Current state
- v1.9.0 (versionCode 15) sudah di-release (APK + version.json via GitHub Releases) — build CI sukses setelah fix CMake.
- Remote SSH; push terakhir sukses dari Windows. Commit lokal terakhir `ef73fc4`.
- **Backend VPS belum di-redeploy** (kode notifikasi weekend + fix dist/main belum di server).
- Migrasi `swap_resolved_at` sudah di-apply di DB lokal.
- Push end-to-end **belum di-test** di device fisik (baru siap: CLI + icon + config).

## Next session starts with
1. **Redeploy backend VPS** (pull `development`, `docker compose up -d --build backend`, pastikan `dist/main` jalan + migrate prod).
2. **Test push di device fisik**: install APK 1.9.0 → login → cek `anggota.push_token` terisi → `bun run notif:test` → pilih rumah Kos Mawar → trigger skenario (weekend status, galon, denda).
3. Lanjut **M6**: E2E hybrid (lokal dulu) per alur inti (auth, onboarding, beranda, piket, denda, tagihan, swap, galon, notif), lalu final verification di VPS.

## Open questions
- Play Store? (M6 "final release" saat ini = in-app update via GitHub Releases, bukan store)
- Kapan M5 items (Beranda/Piket/Tagihan/Swap/Profile) ditandai selesai di progress-tracker — fitur sudah dibangun, tapi checkbox M5 masih unchecked.
