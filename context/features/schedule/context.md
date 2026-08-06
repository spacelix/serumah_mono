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

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/schedule/week?monday=YYYY-MM-DD` | — | `Jadwal[]` for that week | Defaults to current week. |
| POST | `/schedule/generate/weekday` | — (admin) | `{ count }` | Generate next week round-robin (manual on-demand). |
| POST | `/schedule/generate/rest-of-week` | — (admin) | `{ count }` | **First-time**: backfill the rest of the current week (today→Sunday, weekday + weekend from Di kos). Next week is handled by cron. |
| POST | `/schedule/generate/weekend` | — (admin) | `{ count }` | Generate weekend from Di kos status. |
| PUT | `/schedule/weekend-status` | `{ hari, status }` | `{ weekendStatus }` | Set Di kos/Pulang. Validates not yet frozen. |
| POST | `/schedule/run-auto-fine` | — (internal) | `{ fined }` | Cron. Do not expose publicly without a service guard. |

## 4. Business Rules & State Machine
Locked decisions (from the old phase, preserved):

**Weekday round-robin:**
- Piket days: Senin, Rabu, Jumat (every other day). Selasa+Kamis off.
- Sort members by `created_at`. Cycle across weeks: A→B→C→D→A…
- No back-to-back automatically satisfied (Selasa/Kamis gap).
- New member joins: continue the cycle from where it left off without reset. Member leaves: skip from the cycle, regenerated schedules are rebuilt.

**Weekend:**
- Generated from members with status `di_kos`. All `pulang` → day **Free** (no fine).
- Freeze: Friday 20:00 (configurable). No update → default to last week's status.
- The `hari` column = saturday/sunday per row (drift, preserved).

**Auto-fine:**
- Submit deadline: 20:00. Cron daily 22:00, skips Selasa/Kamis.
- Scheduled day without submission → create `PiketSubmission` status `bolong` + `Denda` flat `rumah.nominal_denda`.

## 5. UI Spec (React Native)
- **ScheduleList** (Beranda): 7 rows, status tags (see dashboard).
- **Rumah Management**: **"Generate Jadwal"** button (admin only) → calls `/schedule/generate/rest-of-week`. Card sits at the **bottom** of Kelola Rumah, **disabled** when the current week is already fully scheduled (`scheduleIncomplete` = false). Pekan depan is generated automatically by cron — the button only backfills today→Sunday.
- **Beranda banner (PJ only, not in design):** brick-soft reminder shown when `isAdmin && scheduleIncomplete`. Tapping it opens `/rumah/manage?scrollTo=generate` which auto-scrolls to the Generate Jadwal card.

## 6. Constraints / Prohibited
- Client CANNOT assign schedules — server only (prevents manipulation).
- Do not generate schedules for the past.
- Weekend freeze is a server boundary — don't trust the client for time.
- Round-robin logic must never live in the UI.

## 7. Dependencies
- Required read: `features/piket/context.md`, `features/denda/context.md` (auto-fine), `features/dashboard/context.md`.

## 8. Status
Not yet implemented (awaiting Phase 2–3). Round-robin logic from the Flutter phase must be ported to a NestJS service.
