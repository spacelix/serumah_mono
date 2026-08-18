# Feature Context — Schedule

## 1. Goal & Scope

Automatic piket schedule generation: weekday round-robin (Senin/Rabu/Jumat), dynamic weekend, status freeze, and auto-fine for missed deadline. The most complex business logic — all in NestJS services + cron. The UI only displays it (schedule list) plus the admin generate button.

## 2. Data Model

- `Jadwal`: `rumahId`, `tanggal`, `anggotaId`, `ruangan[]` (snapshot of room names, ordered by `urutan`).
- `WeekendStatus`: `anggotaId`, `mingguMulai`, `hari` ('sabtu'/'minggu'), `status` ('di_kos'/'pulang').
- `PiketSubmission` + `Denda` (for status/auto-fine).
- `Ruangan` + `JenisPiket` (only rooms with `is_active=true` appear in the schedule).

## 3. API Contract (NestJS)

Module: `schedule`.

| Method | Path                               | Request            | Response                 | Notes                                                                                                                                                                                                                                                                          |
| ------ | ---------------------------------- | ------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/schedule/week?monday=YYYY-MM-DD` | —                  | `Jadwal[]` for that week | Defaults to current week.                                                                                                                                                                                                                                                      |
| POST   | `/schedule/generate/weekday`       | — (admin)          | `{ count }`              | Generate next week round-robin (manual on-demand).                                                                                                                                                                                                                             |
| POST   | `/schedule/generate/rest-of-week`  | — (admin)          | `{ count }`              | **First-time**: backfill the rest of the current week (today→Sunday, weekday + weekend from Di kos). Next week is handled by cron.                                                                                                                                             |
| POST   | `/schedule/generate/weekend`       | — (admin)          | `{ count }`              | Generate weekend from Di kos status.                                                                                                                                                                                                                                           |
| POST   | `/schedule/refresh-future-rooms`   | — (admin)          | `{ updated }`            | **Refresh only** the `ruangan[]` snapshot of future Jadwal rows (days after today) so only rooms with an active jenis piket appear. Member assignment is preserved; past days untouched. Triggered from Kelola Rumah when leaving after adding a jenis piket (confirm dialog). |
| PUT    | `/schedule/weekend-status`         | `{ status }`       | `{ status }`           | Set Di kos/Pulang untuk **seluruh weekend** (Sabtu + Minggu di-set bersamaan). Validates not yet frozen. **Cooldown 6 jam antar perubahan (locked 2026-08-12).** |
| POST   | `/schedule/run-auto-fine`          | — (internal)       | `{ fined }`              | Cron. Do not expose publicly without a service guard.                                                                                                                                                                                                                          |

## 4. Business Rules & State Machine

Locked decisions (from the old phase, preserved):

**Weekday round-robin:**

- Piket days: Senin, Rabu, Jumat (every other day). Selasa+Kamis off.
- Sort members by `created_at`. Cycle across weeks: A→B→C→D→A…
- No back-to-back automatically satisfied (Selasa/Kamis gap).
- **No duplicate weekday in one week (fixed 2026-08-11):** `ensureWeekday` excludes members who already hold another weekday Jadwal row that same week from the pick pool — so no one piket twice on Senin/Rabu/Jumat. This also keeps the assignment stable when the pool shrinks after a weekend assignee is excluded (`reconcileWeekdayForWeekend`). If the exclude-assigned pool would be empty (fewer members than piket days), it falls back to all non-weekend members so the day still gets scheduled.
- New member joins: continue the cycle from where it left off without reset. Member leaves: skip from the cycle, regenerated schedules are rebuilt.
- **Generate manual bulanan (locked 2026-08-12):** TIDAK ada cron jadwal (`pregenerateWeek`/`selfHealWeek`/`freezeWeekendCron` dihapus). PJ menekan **"Generate Jadwal"** → generate **weekday (Sen/Rab/Jum) dari hari ini sampai AKHIR BULAN BERIKUTNYA** (batas kalender). Auto-fine cron (22:00) tetap berjalan.
- **Jadwal habis → notif PJ + empty state (locked 2026-08-12):** cron **22:00** (`scheduleExhaustedReminder`) cek jadwal weekday masa depan. Jika tidak ada lagi (hari ini ke depan), kirim notif ke PJ **sekali** (via Redis marker `schedule:exhausted:{rumahId}`, TTL 45 hari; di-reset saat generate). Empty state + tombol Generate muncul otomatis karena minggu kosong.

**Weekend:**

- Generated from members with status `di_kos`. All `pulang` → day **Free** (no fine).
- **No back-to-back weekend (fixed 2026-08-11):** `ensureWeekendWeek` membagi member di_kos ke weekend. Aturan (locked 2026-08-12): urutkan di_kos — **pemilik slot weekday yang belum lewat dulu** (A=Rabu, B=Jumat, dihitung `weekdayOrdinal(day) % n`), lalu non-owner (PJ, C). **Assign bergantian Sabtu/Minggu** atas daftar ini: hanya B di_kos → B Sabtu; A+B → A Sabtu, B Minggu; A+B+PJ → A Sabtu, PJ tumpuk Sabtu, B Minggu; +C → C tumpuk Minggu. Beberapa orang boleh di hari sama. Query weekendStatus scoped `status:'di_kos'` + rumah ini.
- **Weekend event-driven (locked 2026-08-12):** generate bulan HANYA membuat weekday. Weekend di-generate saat user memilih `di_kos` utk minggu itu (`setWeekendStatus` → `ensureWeekendWeek`). Future weeks tampil Free sampai ada yang pilih.
- Freeze: Friday 20:00 (configurable). No update → default to last week's status.
- **Satu pilihan utk seluruh weekend (locked 2026-08-11):** `WeekendStatusDto` hanya `{ status }` — pilihan Di kos/Pulang berlaku untuk Sabtu DAN Minggu sekaligus (backend set kedua baris `weekend_status`).
- **Cooldown ganti status 6 jam (locked 2026-08-12):** setelah mengubah status, user TIDAK boleh ganti lagi dalam 6 jam (`WeekendStatus.updatedAt`). Server tolak dgn `400` + pesan menit tersisa; dashboard expose `nextChangeAt` supaya tombol di-disable + hint "Ganti status lagi pukul HH:MM WIB".
- The `hari` column = saturday/sunday per row (drift, preserved).
- **Generate on Di kos (locked 2026-08-08):** choosing `di_kos` for a weekend day immediately generates that day's Jadwal so the UI shows who piket right away.
- **Pulang menghapus jadwal weekend (locked 2026-08-12):** saat anggota mengubah status dari `di_kos` ke `pulang`, sistem **menghapus baris Jadwal weekend milik anggota tersebut** untuk minggu itu, lalu menjalankan `ensureWeekendWeek` untuk mendistribusikan ulang anggota `di_kos` yang tersisa.
- **Bebas weekday tanpa regenerate (locked 2026-08-12):** saat user pilih `di_kos`, pada minggu itu dia bebas piket weekday — baris Jadwal weekday miliknya di minggu itu (Sen/Rab/Jum SAJA) **dihapus dan TIDAK digantikan siapa pun**. Weekend yang dibuat `ensureWeekendWeek` **tidak terhapus** (fix 2026-08-12).
- **Pulang → weekday kembali (locked 2026-08-12):** saat pilih `pulang`, jadwal weekend miliknya dihapus, lalu `restoreWeekdayForMember` mengembalikannya ke hari piket yang memang miliknya (`weekdayOrdinal(day) % n` — A→Rabu, B→Jumat). Hanya hari miliknya yang disentuh; slot anggota lain tidak tertimpa.
- **Weekend aktif hanya jika dapat jadwal (locked 2026-08-12):** di daftar jadwal, Sabtu/Minggu ditampilkan aktif (Terjadwal/Selesai) HANYA jika ada record Jadwal hari itu. Kalau tidak ada yang dapat piket (record null) → `Free` (tidak aktif). Dengan 1 orang di_kos, Sabtu aktif dan Minggu Free.
- **Notifikasi status (locked 2026-08-11):** `setWeekendStatus` mengirim push ke **semua anggota lain** ("{nama} Di kos akhir pekan ini." / "{nama} pulang akhir pekan ini.").

**Auto-fine:**

- Submit deadline: 20:00. Cron daily 22:00, skips Selasa/Kamis.
- Scheduled day without submission → create `PiketSubmission` status `bolong` + `Denda` flat `rumah.nominal_denda`.
- **Bug fix (2026-08-18):** `runAutoFineCron` mengirim `new Date()` (jam 22:00) mentah ke `autoFineForRumah`, padahal `deadline(date)` menghitung 20:00 WIB dari komponen tanggal UTC-midnight → deadline bergeser ~22 jam ke depan → `now <= deadline` selalu true → **tidak pernah di-fine**. Fix: cron memakai `this.toDate(new Date())` (normalisasi UTC-midnight), konsisten dengan endpoint manual `runAutoFine`.

## 5. UI Spec (React Native)

- **ScheduleList** (Beranda): 7 rows, status tags (see dashboard).
- **Rumah Management**: **"Generate Jadwal"** button (admin only) → calls `/schedule/generate/rest-of-week` (generate weekday hari ini → +1 bulan). Card sits at the **bottom** of Kelola Rumah, **disabled** ketika jadwal sudah ada (ada baris weekday di masa depan). Tidak ada auto-generate — PJ harus menekan tombol tiap bulan.
- **Empty state**: saat jadwal belum digenerate / sudah habis (tidak ada jadwal weekday masa depan), daftar jadwal menampilkan **empty state + tombol Generate** (bukan banner reminder).

**Adding a jenis piket (Kelola Rumah):** after an admin adds a jenis piket, the future days' `ruangan[]` snapshot is stale (new room not yet included). When the admin **leaves** the Kelola Rumah page, a confirm dialog offers to call `/schedule/refresh-future-rooms` — only future days are updated, member assignment kept, so only rooms with an active jenis piket appear in the remaining schedule. If the admin cancels, the dialog is dismissed and no refresh occurs.

- **Beranda banner (PJ only, not in design):** brick-soft reminder shown when `isAdmin && scheduleIncomplete`. Tapping it opens `/rumah/manage?scrollTo=generate` which auto-scrolls to the Generate Jadwal card.

## 6. Constraints / Prohibited

- Client CANNOT assign schedules — server only (prevents manipulation).
- Do not generate schedules for the past.
- Weekend freeze is a server boundary — don't trust the client for time.
- Round-robin logic must never live in the UI.
- **Timezone (locked 2026-08-07):** all calendar math uses **WIB (UTC+7)** wall-clock days. `@db.Date` columns are stored by Prisma as UTC date strings, so services build every calendar date as a **UTC-midnight** Date (helper adds `+WIB_OFFSET_MS` before reading UTC components) and compare day-of-week via `getUTCDay()`. Weekday day-of-week, weekend hari, freeze (Fri 20:00 WIB), and fine deadline (20:00 WIB) all follow this. This makes behavior identical whether the server runs in UTC (Docker) or WIB (dev) — fixing the "banner/generate shows though schedule exists" bug where local-midnight dates were shifted one day by Prisma.

## 7. Dependencies

- Required read: `features/piket/context.md`, `features/denda/context.md` (auto-fine), `features/dashboard/context.md`.

## 8. Status

Implemented in `apps/api/src/modules/schedule/schedule.service.ts`. Last fix: pulang status now deletes the member's weekend Jadwal rows and regenerates the remaining weekend roster (2026-08-12).
