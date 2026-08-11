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
| PUT    | `/schedule/weekend-status`         | `{ hari, status }` | `{ weekendStatus }`      | Set Di kos/Pulang. Validates not yet frozen.                                                                                                                                                                                                                                   |
| POST   | `/schedule/run-auto-fine`          | — (internal)       | `{ fined }`              | Cron. Do not expose publicly without a service guard.                                                                                                                                                                                                                          |

## 4. Business Rules & State Machine

Locked decisions (from the old phase, preserved):

**Weekday round-robin:**

- Piket days: Senin, Rabu, Jumat (every other day). Selasa+Kamis off.
- Sort members by `created_at`. Cycle across weeks: A→B→C→D→A…
- No back-to-back automatically satisfied (Selasa/Kamis gap).
- **No duplicate weekday in one week (fixed 2026-08-11):** `ensureWeekday` excludes members who already hold another weekday Jadwal row that same week from the pick pool — so no one piket twice on Senin/Rabu/Jumat. This also keeps the assignment stable when the pool shrinks after a weekend assignee is excluded (`reconcileWeekdayForWeekend`). If the exclude-assigned pool would be empty (fewer members than piket days), it falls back to all non-weekend members so the day still gets scheduled.
- New member joins: continue the cycle from where it left off without reset. Member leaves: skip from the cycle, regenerated schedules are rebuilt.
- **Cron (locked 2026-08-10):** `pregenerateWeek` Sabtu 06:00 → generate **minggu depan** (Senin+7). **`selfHealWeek` harian 06:00** → ensure **minggu ini** (today→Minggu, tidak pernah hari lampau) — self-heal kalau cron Sabtu terlewat (server down), Senin pagi tetap tergenerate. Keduanya idempoten via `ensureWeekday` (skip baris yang sudah ada). **Independen dari `refreshFutureRooms`** (jenis piket): self-heal hanya membuat baris baru, `refreshFutureRooms` hanya update snapshot `ruangan[]` pada baris masa depan — tidak saling menimpa.

**Weekend:**

- Generated from members with status `di_kos`. All `pulang` → day **Free** (no fine).
- Freeze: Friday 20:00 (configurable). No update → default to last week's status.
- The `hari` column = saturday/sunday per row (drift, preserved).
- **Generate on Di kos (locked 2026-08-08):** choosing `di_kos` for a weekend day immediately generates that day's Jadwal (picks one di_kos member round-robin) so the UI shows who piket right away — before the Friday freeze.
- **Weekday exemption (locked 2026-08-08):** members who hold a weekend Jadwal row that week are **excluded from weekday piket** (Senin/Rabu/Jumat) in the same week — the copy "yang piket Sabtu–Minggu bebas piket Senin–Jumat". `ensureWeekday` filters the round-robin pool with `weekendAssigneeIds`; `setWeekendStatus`/`generateRestOfWeek` regenerate affected weekday rows (weekend generated first so the exclusion applies).
- **Notifikasi status (locked 2026-08-11):** `setWeekendStatus` mengirim push ke **semua anggota lain** ("{nama} pilih Di kos untuk Sabtu" / "{nama} pulang Minggu"), tanpa detail siapa yang dapat piket. Reminder belum pilih via cron Jumat 08:00 + 19:00 (lihat features/notifications).

**Auto-fine:**

- Submit deadline: 20:00. Cron daily 22:00, skips Selasa/Kamis.
- Scheduled day without submission → create `PiketSubmission` status `bolong` + `Denda` flat `rumah.nominal_denda`.

## 5. UI Spec (React Native)

- **ScheduleList** (Beranda): 7 rows, status tags (see dashboard).
- **Rumah Management**: **"Generate Jadwal"** button (admin only) → calls `/schedule/generate/rest-of-week`. Card sits at the **bottom** of Kelola Rumah, **disabled** when the current week is already fully scheduled (`scheduleIncomplete` = false). Pekan depan is generated automatically by cron — the button only backfills today→Sunday.

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

Not yet implemented (awaiting Phase 2–3). Round-robin logic from the Flutter phase must be ported to a NestJS service.
