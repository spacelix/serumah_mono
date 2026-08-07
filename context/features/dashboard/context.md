# Feature Context — Dashboard (Beranda)

## 1. Goal & Scope
Main page of the 4-tab app. Displays: weekend status toggle, galon widget, billing summary, and this week's schedule list. This is a READ aggregation of other features — no business logic of its own.

## 2. Data Model
Reads:
- `WeekendStatus` (Di kos/Pulang toggle per saturday/sunday).
- `GiliranGalon` (galon widget).
- `IuranBulanan` + `Denda` (billing summary — total unpaid).
- `Jadwal` + `Ruangan` (weekly schedule list).

## 3. API Contract (NestJS)
Module: `dashboard` (aggregate) or existing endpoints.

| Method | Path | Response | Notes |
|---|---|---|---|
| GET | `/dashboard` | `{ weekend, galon, billing, scheduleWeek, scheduleIncomplete, isAdmin }` | Aggregate in one call for one screen. |

Payload composition:
- `weekend`: saturday & sunday status for the current week (`WeekendStatus`).
- `galon`: active turn (`GiliranGalon` + member name).
- `billing`: `{ totalUnpaid, countUnpaid, bulan }` from the user's iuran + denda.
- `scheduleWeek`: 7 days (Senin–Minggu), each `{ tanggal, dow, ruanganNames[], statusTag }`.
- `scheduleIncomplete`: true when an upcoming piket day this week (today→Sunday) is not yet scheduled (weekday without Jadwal, or weekend with Di kos members without Jadwal).
- `isAdmin`: whether the caller is the PJ (`role='admin'`).

## 4. Business Rules & State Machine
Locked decisions:
- Weekday piket only Senin/Rabu/Jumat. Selasa+Kamis labeled **"LIBUR"**.
- Weekend: tag from `weekend_status` (Di kos / Pulang) or **Free** when everyone is home.
- Per-day status tag: `Hari ini` | `Selesai` | `Terjadwal` | `Bolong` | `Free` | `LIBUR`.
- Weekend toggle is ONLY available until freeze (Friday 20:00). After that read-only (see `schedule`).
- Billing summary only for the user (not all members).

## 5. UI Spec (React Native)
Screen: `app/(tabs)/index.tsx`. Components: `WeekendCard`, `GalonWidget`, `BillingSummary`, `ScheduleList`.

- **WeekendCard** (hero, bg pine): "Minggu ini lo di kos atau pulang?" + per-day toggle (Sabtu, Minggu). States: Di kos / Pulang.
- **GalonWidget** (gold accent, 4px left border): "Giliran galon: [Nama]" + **"Sudah Beli"** button (see galon).
- **BillingSummary**: concise total unpaid + **"Lihat detail"** → navigate to Tagihan tab.
- **ScheduleList**: 7 rows (Senin–Minggu). Each: date chip (mono, mustard if today), member name, room names, status tag. LIBUR dashed.
- Header: avatar chip (tap → Profile).
- **ScheduleReminderBanner (admin only, not in design):** brick-soft banner shown when `scheduleIncomplete`. Tap → `/rumah/manage?scrollTo=generate`.

## 6. Constraints / Prohibited
- Do not recompute splits in the UI — read from the API.
- Do not show denda/iuran detail on Beranda (only summary + link to Tagihan).
- No generate-schedule button here; the banner is a *link* to Rumah Management (where the button lives).

## 7. Dependencies
- Required read: `features/schedule/context.md`, `features/galon/context.md`, `features/iuran/context.md`, `features/denda/context.md`.

## 8. Status
Not yet implemented (awaiting Phase 2–3).
