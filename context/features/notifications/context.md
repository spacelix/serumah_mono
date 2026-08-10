# Feature Context — Notifications (Push)

## 1. Goal & Scope

Push notifications. Backend (self-hosted NestJS) sends; React Native (Expo) receives. Sender: **Expo Push Service** (`https://exp.host/--/api/v2/push/send`) — best practice per docs.expo.dev, Expo yang relay ke FCM/APNs, tanpa FCM credentials di server.

Locked principle (2026-08-10): **hanya notif yang butuh approver + pengingat wajib yang dikirim.** Tidak semua aksi → notif.

## 2. Data Model

- `Anggota.pushToken` (`String?`, map `push_token`) + `pushTokenUpdatedAt` (`DateTime?`) — **Expo push token** per device.
- Migrasi: `add_push_token`.

## 3. Env & Android Config

- **Backend tidak butuh FCM env** — cukup kirim token Expo ke `exp.host`. (FCM vars tidak diperlukan.)
- Mobile env: **`EXPO_PUBLIC_EAS_PROJECT_ID`** (Expo project id) — dipakai `getExpoPushTokenAsync({ projectId })`; fallback dari `extra.eas.projectId` (EAS inject saat build).
- Mobile Android: **`google-services.json`** (dari Firebase console, app `com.serumah.serumah`) → `apps/mobile/google-services.json` (gitignored, di-inject CI via secret `GOOGLE_SERVICES_BASE64`). Di-refer dari `app.json` → `android.googleServicesFile`. Plus **FCM V1 service account key** di EAS (untuk build app, bukan server).
- Mobile deps: `expo-notifications` (SDK 57 compatible), `expo-device` (sudah ada). **Tidak bisa diuji via Expo Go (push Android dihapus sejak SDK 53) — harus development build / APK.**
- Token yang dikirim = **Expo push token** (`Notifications.getExpoPushTokenAsync`, format `ExponentPushToken[...]`).

## 4. Locked Notification Set

### A. Piket reminders — cron, ke yang piket hari itu (dari `Jadwal.tanggal=today`), **skip jika sudah ada submission**

| Waktu (cron) | Pesan (Bahasa Indonesia) |
|---|---|
| Pagi `0 7 * * *` | "Piket lo hari ini — {ruangan}, deadline 20:00" |
| Siang `0 12 * * *` | "Jangan lupa piket sebelum jam 8 malam" |
| Sore `0 17 * * *` | "Piket belum dikerjain? Sisa 3 jam" |
| **19:50** `50 19 * * *` | "10 menit lagi deadline piket!" |

- Weekend: deadline tetap 20:00 (berlaku sama).
- Deep link: `/(tabs)/piket`.

### B. Reviewer/approver — event-driven (hook di service, bukan cron)

| Pemicu | Penerima | Pesan | Deep link |
|---|---|---|---|
| Submission piket diajukan | reviewer (PJ utk member; round-robin utk PJ) | "Ada piket nunggu diverifikasi" | `/(tabs)/piket` |
| Swap diajukan | penerima swap | "Ada permintaan swap masuk" | `/(tabs)/swap` |
| **Swap diterima** | pengaju swap | "Swap lo diterima — {tanggal} jadi jadwal {penerima}, {tanggalKe} jadi jadwal lo" | `/(tabs)/swap` |
| **Swap ditolak** | pengaju swap | "Swap lo ditolak — jadwal balik ke lo" | `/(tabs)/swap` |
| Bukti bayar denda diupload | reviewer pembayaran | "Ada bukti bayar denda nunggu konfirmasi" | `/(tabs)/tagihan` |
| Bukti iuran diupload | reviewer pembayaran | "Ada bukti iuran nunggu konfirmasi" | `/(tabs)/tagihan` |

### B2. Galon — event-driven (hook di `galon.service.ts`)

| Pemicu | Penerima | Pesan | Deep link |
|---|---|---|---|
| **Galon dibeli** (`confirm`) | **semua anggota rumah** (selain pembeli) | "{nama} udah beli galon — giliran berikutnya {namaBerikutnya}" | `/(tabs)` (beranda) |
| **Nudge giliran berikutnya** | member giliran aktif berikutnya | "Giliran galon lo — udah saatnya beli" | `/(tabs)` (beranda) |

- `confirm` di `GalonService.confirm` → setelah `rotateGalon` menentukan next member, kirim: (1) notif "sudah dibeli" ke semua anggota; (2) nudge ke next member.
- Nudge bisa juga dipicu manual (tombol bel galon di beranda) → `POST /galon/nudge` (dikirim ke member giliran aktif).


### C. Denda reminder — cron mingguan

- `0 8 * * 1` (Senin 08:00): ke anggota yang punya `Denda.status='belum_bayar'` → "Lo punya {n} denda belum dibayar, total {amount}". Deep link `/(tabs)/tagihan`.

### D. Iuran bulan depan — cron **hari terakhir bulan** 08:00

- Guard `last-day-of-month` (30 utk 30-hari; 28/29 utk Februari) — bukan tepat tgl 30.
- **Generate iuran bulan depan dulu** via `IuranService.ensureBulan` (bulan berikutnya), lalu kirim ke semua anggota: "Iuran {bulan depan} sudah keluar, tagihan lo {amount}". Deep link `/(tabs)/tagihan`.

## 5. API Contract (NestJS)

Module: `fcm` + `notifications`.

| Method | Path          | Request        | Response | Notes                                                       |
| ------ | ------------- | -------------- | -------- | ----------------------------------------------------------- |
| POST   | `/push/token` | `{ token }`    | `{ ok }` | Simpan `pushToken` + updatedAt ke `Anggota`.                |
| DELETE | `/push/token` | —              | `{ ok }` | Hapus token (logout).                                       |
| POST   | `/galon/nudge`| —              | `{ ok }` | Kirim notif nudge ke member giliran galon aktif (tombol bel). |

Hooks di service (kirim notif, bukan endpoint): `piket.service` (submit→reviewer), `swap.service` (create→penerima; accept/reject→pengaju), `denda.service`/`iuran.service` (upload-bukti→reviewer pembayaran), `galon.service` (confirm→semua anggota + next member).

## 6. Push Sending (FcmService)

- `POST https://exp.host/--/api/v2/push/send` — body `{ to: <ExponentPushToken>, title, body, data: { deepLink } }`. **Tanpa auth** (Expo Push API).
- Token `DeviceNotRegistered` → hapus `pushToken`.
- **Idempoten:** semua pengiriman di-guard — piket reminder cek status submission; reviewer/denda/iuran cek status transaksi; denda mingguan cek `belum_bayar`; iuran cek bulan belum lunas/tergenerate.

## 7. Mobile (expo-notifications)

- `app/_layout.tsx`: `requestPermissionsAsync` saat login/start; **`getExpoPushTokenAsync({ projectId: expoProjectId() })`** → `POST /push/token`; refresh saat app start; `setNotificationHandler` agar tampil saat foreground.
- `NotificationResponse` listener → `router.push(data.deepLink)` (parser `routeForDeepLink` tunggal di `lib/notifications.ts`).
- Foreground: banner/toast (handler di atas).
- Android channel id konsisten (`serumah`).
- Log push di-gate `__DEV__` (tidak mencetak token di produksi).
- **Harus development build / APK release** — Expo Go tidak mendukung push Android (SDK 53+).

## 8. Files

- DB: `packages/db/prisma/schema.prisma` + migrasi `add_push_token`.
- API: `modules/fcm/` (fcm.module, fcm.service, push-token.controller), `modules/notifications/` (notifications.module/service + cron), hook di `piket.service`, `swap.service` (create/accept/reject), `denda.service`, `iuran.service`, `galon.service` (confirm + nudge); `IuranService.ensureBulan` dipanggil cron iuran.
- Mobile: `lib/notifications.ts`, `app/_layout.tsx`, `app.json` (channel), `GalonWidget` (nudge → `POST /galon/nudge`).

## 9. Dependencies

- Required read: `features/schedule/context.md` (jadwal+deadline), `features/piket/context.md` (reviewer), `features/swap/context.md` (penerima + pengaju), `features/denda/context.md` + `features/iuran/context.md` (reviewer pembayaran), `features/galon/context.md` (giliran + nudge), `features/iuran/context.md` (ensureBulan).

## 10. Status

Implemented 2026-08-10 (menunggu verify: Prisma regenerate `pushToken` + test). Skenario A–D + galon + swap accept/reject terpasang. Migrasi `add_push_token` belum di-apply.
