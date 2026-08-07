# Feature Context — Galon

## 1. Goal & Scope

Water gallon (galon) rotation widget on Beranda. Tracks the turn + a "Sudah Beli" button that advances rotation. **No amount/reimbursement** — the buyer bears the cost.

## 2. Data Model

- `GiliranGalon`: `anggotaId`, `periodeMulai`, `status` ('menunggu'/'sudah_dibeli'), `confirmedAt`. WITHOUT a nominal column (locked decision).

## 3. API Contract (NestJS)

Module: `galon`.

| Method | Path                 | Request | Response                   | Notes                                                                               |
| ------ | -------------------- | ------- | -------------------------- | ----------------------------------------------------------------------------------- |
| GET    | `/galon/current`     | —       | `{ giliran, namaAnggota }` | Active turn (status `menunggu`), ordered `periodeMulai` asc limit 1.                |
| POST   | `/galon/:id/confirm` | —       | `{ next }`                 | Set `sudah_dibeli` + `confirmedAt`, rotate to next member (round-robin). No amount. |

## 4. Business Rules & State Machine

Locked decisions:

- Status: `menunggu` → `sudah_dibeli` → rotate forward.
- **No amount / reimbursement** — buyer bears the cost.
- Rotation does not create an iuran addon (addon category removed).
- Key: active-turn query must filter `status='menunggu'` order `periodeMulai` asc limit 1 (fix for the old error-406 era).

## 5. UI Spec (React Native)

Widget on Beranda (`GalonWidget`):

- Gold-accented card (4px left border), galon icon.
- "Giliran galon: **[Nama]**".
- **When it's the user's turn (`isMine`):** **"Sudah Beli"** button → confirm → rotate. Instant feedback (turn name advances). After confirming, a green chip appears: **"Tercatat. Giliran maju ke [Nama] · notif terkirim."** (bg `pineSoft`, text `pine`).
- **When it's another member's turn:** a **bell/notif icon button** (36×36, bordered, bell glyph) — "colek"/nudge. Below it the hint text **"Galon habis? colek dia biar segera beli"**; after tapping, the button tints and the text becomes **"Notif sudah dikirim ke [Nama]"** (local UI state, no backend call — FCM not wired).
- Info notification: "Giliran beli galon: [Nama]" (not required in v1).

## 6. Constraints / Prohibited

- No amount input.
- No reimbursement / iuran addon.
- Never show a nominal column (already removed from schema).

## 7. Dependencies

- Required read: `features/dashboard/context.md`.

## 8. Status

Not yet implemented (awaiting Phase 2–3).
