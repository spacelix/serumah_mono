# Feature Context — Swap

## 1. Goal & Scope

Exchange piket schedule days between members. All-or-nothing — one full day moves from one person to another. Not per-task/per-room.

## 2. Data Model

- `SwapRequest`: `dariAnggotaId`, `keAnggotaId`, `tanggal`, `status` ('diajukan'/'diterima'/'ditolak').

## 3. API Contract (NestJS)

Module: `swap`.

| Method | Path                   | Request                    | Response             | Notes                                                                                                    |
| ------ | ---------------------- | -------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------- |
| GET    | `/swap`                | —                          | `{ incoming, mine }` | incoming = status `diajukan` for the user. mine = all user requests (history).                           |
| POST   | `/swap`                | `{ tanggal, keAnggotaId }` | `{ swapRequest }`    | Validate: date has a schedule for the user, not an off day (Sel/Kam), keAnggota ≠ self, no duplicate.    |
| POST   | `/swap/:id/accept`     | —                          | `{ swapRequest }`    | Validate receiver. Schedule moves from `dariAnggotaId` → `keAnggotaId` for `tanggal`. Status `diterima`. |
| POST   | `/swap/:id/reject`     | —                          | `{ swapRequest }`    | Status `ditolak`. Schedule stays.                                                                        |
| GET    | `/swap/available-days` | —                          | `tanggal[]`          | Next 2 weeks from the user's `jadwal`, excluding off days & already-scheduled.                           |

## 4. Business Rules & State Machine

Locked decisions:

- All-or-nothing — full day transfer, not per-task.
- `diajukan` → `diterima` (schedule moves) or `ditolak` (stays).
- Only the receiver accepts/rejects (server-side validation `keAnggotaId` = current user).
- Swap only for already-scheduled days (not off days).
- Swap history kept for audit (all statuses remain visible in "mine").

## 5. UI Spec (React Native)

Tab **Swap** (`app/(tabs)/swap.tsx`). Component: `SwapRequestCard`.

- **Incoming**: card with 2 name+date boxes connected by ⇄ icon + **Terima** (pine) / **Tolak** (brick outline) buttons.
- **Mine**: list of user requests with status stamps (DIAJUKAN / DITERIMA / DITOLAK).
- CTA **"Ajukan swap baru"** (dashed card) → 2-step bottom sheet: pick available day → pick member. Submit.

## 6. Constraints / Prohibited

- Cannot swap off days (Selasa/Kamis).
- Cannot swap to a day already scheduled by someone else.
- No partial-room swap.
- **Timezone (locked 2026-08-08):** `tanggal` is stored as `@db.Date` (Prisma persists UTC components). Calendar math uses UTC-midnight dates, resolves "today" by shifting +7h (WIB), and off-day check uses `getUTCDay()`. Same WIB/UTC rule as schedule.

## 7. Dependencies

- Required read: `features/schedule/context.md` (available days), `features/piket/context.md`.

## 8. Status

Not yet implemented (awaiting Phase 2–3).
