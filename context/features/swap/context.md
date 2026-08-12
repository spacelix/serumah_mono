# Feature Context — Swap

## 1. Goal & Scope

Exchange piket schedule days between members. **Mutual all-or-nothing (locked 2026-08-10):** two full days swap — the requester's day moves to the receiver and the receiver's day moves to the requester. Not per-task/per-room.

## 2. Data Model

- `SwapRequest`: `dariAnggotaId`, `keAnggotaId`, `tanggal` (hari si pengaju), `tanggalKe` (hari si penerima yang ditukar), `status` ('diajukan'/'diterima'/'ditolak'), `createdAt`, `resolvedAt` (waktu accept/reject — untuk Histori swap).

## 3. API Contract (NestJS)

Module: `swap`.

| Method | Path                   | Request                              | Response             | Notes                                                                                                                        |
| ------ | ---------------------- | ------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/swap`                | —                                    | `{ incoming, mine }` | incoming = status `diajukan` for the user. mine = all user requests (history). Each `SwapRequest` includes `tanggal` + `tanggalKe`. |
| POST   | `/swap`                | `{ tanggal, tanggalKe, keAnggotaId }` | `{ swapRequest }`    | Validate: `tanggal` = scheduled piket day milik pengaju; `tanggalKe` = scheduled piket day milik `keAnggotaId`; bukan hari libur; bukan diri sendiri; no duplicate. |
| POST   | `/swap/:id/accept`     | —                                    | `{ swapRequest }`    | Validate receiver. **Mutual**: jadwal `tanggal` pindah `dari → ke` DAN jadwal `tanggalKe` pindah `ke → dari`. Status `diterima`. |
| POST   | `/swap/:id/reject`     | —                                    | `{ swapRequest }`    | Status `ditolak`. Schedule stays.                                                                                            |
| GET    | `/swap/available-days` | —                                    | `{ tanggal, ruangan[] }[]` | Hari piket milik user + daftar ruangan hari itu (**minggu berjalan** Senin–Minggu, hanya hari ≥ hari ini), untuk step 1 form. |
| GET    | `/swap/target-days`    | —                                    | `{ id, nama, days: { tanggal, ruangan[] }[] }[]` | Anggota lain + hari piket mereka (**minggu berjalan**), untuk step 2 form (pilih hari target). |

## 4. Business Rules & State Machine

Locked decisions:

- **Mutual all-or-nothing (2026-08-10):** full 2-day exchange — requester's day → receiver, receiver's day → requester.
- `diajukan` → `diterima` (both schedules move) or `ditolak` (both stay).
- Only the receiver accepts/rejects (server-side validation `keAnggotaId` = current user).
- Swap only for already-scheduled piket days (not off days, not Selasa/Kamis).
- Cannot swap a day that already has a piket submission.
- Swap history kept for audit (all statuses remain visible in "mine" / "Histori swap").

## 5. UI Spec (React Native)

Tab **Swap** (`app/(tabs)/swap.tsx`). Header kicker **"All-or-nothing · 1 hari penuh"**.

- **Grup atas tanpa header**: kartu "Request masuk" (swap diajukan ke user — ada tombol Terima/Tolak) + kartu "Request lo" (swap user yang masih `diajukan` — tanpa tombol, note "Nunggu {nama} nerima. Kalau ditolak, jadwal balik ke lo.").
- **Kartu swap**: bg card, border line, radius 18, padding 14, gap 12. Head: kicker mono 500 10px uppercase ("Request masuk"/"Request lo") + waktu relatif mono 400 10.5px. Dua `DayBox` (bg paper, radius 13, padding 11) dipisah teks `⇄` Space Grotesk 600 20px pine. Note Inter 400 11.5/1.45 inkSoft. Aksi Terima (ink) / Tolak (outline line) — flex 1, padding 12, radius 12.
- **CTA "Ajukan swap baru"**: dashed card (paperDeep, lineDash 1.5px, radius 18) — **di BOTTOM, setelah Histori swap** (bukan di atas). Hidden while the form is open.
- **Form** (`SwapForm`): dark ink bottom sheet (radius 20, riseIn 0.26s), **3-langkah**:
  - Step 1 "Pilih hari piket lo" — kartu tanggal (`available-days`): baris 1 `{formatWeekdayDate}` Inter 600 12.5px, baris 2 daftar **ruangan** (mono 400 10.5px paper 0.6) dipisah " · ". Klik kartu langsung lanjut step 2 (tanpa tombol). Hint "Satu hari penuh — semua jenis piket di hari itu ikut pindah."
  - Step 2 "Mau tukar sama hari siapa?" — kartu hari anggota lain (`target-days`): `{formatWeekdayDate} · {nama}` + ruangan. Klik → step 3. Tombol "← Ganti hari lo" kembali step 1. Hint "Cuma hari yang sudah ada penanggung jawabnya bisa ditukar."
  - Step 3 "Cek sekali lagi" — ringkasan dua kotak "LO KASIH" / "LO AMBIL" (bg paper 0.1, radius 13) dipisah `⇄` paper 20px, masing-masing berisi tanggal + ruangan. Tombol **"Kirim ke {nama}"** (paper bg, ink text, flex 1) + **"Ubah"** (outline) kembali step 2. Hint "Request dikirim ke penerima. Kalau ditolak, jadwal balik ke lo."
- **Histori swap** (section "Histori swap · buat audit", judul title-case bukan uppercase): **item kompak** hanya untuk swap yang sudah diproses (`diterima`/`ditolak`) — bg paperDeep, border line, radius 16, padding 12/13: `{formatWeekdayDate} · piket asli {dari.nama} → dikerjain {ke.nama}` (Inter 500 11.5 ink) + baris kedua mono 400 10.5px inkSoft `Diterima/Ditolak {ke.nama} · {formatDateTimeShort(resolvedAt)}`. Tanpa stamp.
- **Filter bulan Histori swap**: bar (card, border line, radius 11) dengan chevron `‹`/`›` + label bulan + `▼` membuka sheet "Pilih bulan" (list bulan yang punya histori + bulan berjalan). **Default = bulan berjalan** (filter dari `resolvedAt ?? createdAt`). Jika hanya ada 1 bulan, bar filter disembunyikan.

## 6. Constraints / Prohibited

- Cannot swap off days (Selasa/Kamis).
- Cannot swap to a day already scheduled by someone else.
- **Swap hanya untuk 1 minggu berjalan** (Senin–Minggu; hanya hari yang belum lewat). Tidak bisa swap untuk minggu berikutnya.
- No partial-room swap.
- **Timezone (locked 2026-08-08):** `tanggal`/`tanggalKe` stored as `@db.Date` (Prisma persists UTC components). Calendar math uses UTC-midnight dates, resolves "today" by shifting +7h (WIB), and off-day check uses `getUTCDay()`. Same WIB/UTC rule as schedule.

## 7. Dependencies

- Required read: `features/schedule/context.md` (available days), `features/piket/context.md`.

## 8. Status

Not yet implemented (awaiting Phase 2–3).
