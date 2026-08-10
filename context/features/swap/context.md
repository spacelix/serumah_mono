# Feature Context — Swap

## 1. Goal & Scope

Exchange piket schedule days between members. **Mutual all-or-nothing (locked 2026-08-10):** two full days swap — the requester's day moves to the receiver and the receiver's day moves to the requester. Not per-task/per-room.

## 2. Data Model

- `SwapRequest`: `dariAnggotaId`, `keAnggotaId`, `tanggal` (hari si pengaju), `tanggalKe` (hari si penerima yang ditukar), `status` ('diajukan'/'diterima'/'ditolak').

## 3. API Contract (NestJS)

Module: `swap`.

| Method | Path                   | Request                              | Response             | Notes                                                                                                                        |
| ------ | ---------------------- | ------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/swap`                | —                                    | `{ incoming, mine }` | incoming = status `diajukan` for the user. mine = all user requests (history). Each `SwapRequest` includes `tanggal` + `tanggalKe`. |
| POST   | `/swap`                | `{ tanggal, tanggalKe, keAnggotaId }` | `{ swapRequest }`    | Validate: `tanggal` = scheduled piket day milik pengaju; `tanggalKe` = scheduled piket day milik `keAnggotaId`; bukan hari libur; bukan diri sendiri; no duplicate. |
| POST   | `/swap/:id/accept`     | —                                    | `{ swapRequest }`    | Validate receiver. **Mutual**: jadwal `tanggal` pindah `dari → ke` DAN jadwal `tanggalKe` pindah `ke → dari`. Status `diterima`. |
| POST   | `/swap/:id/reject`     | —                                    | `{ swapRequest }`    | Status `ditolak`. Schedule stays.                                                                                            |
| GET    | `/swap/available-days` | —                                    | `tanggal[]`          | Hari piket milik user (next 2 weeks), untuk step 1 form.                                                                     |
| GET    | `/swap/target-days`    | —                                    | `{ id, nama, days[] }[]` | Anggota lain + hari piket mereka (next 2 weeks), untuk step 2 form (pilih hari target).                                     |

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

- **CTA "Ajukan swap baru"**: dashed card (paperDeep, lineDash 1.5px, radius 18), title + sub "Satu hari penuh — nggak bisa pilih per jenis piket". Hidden while the form is open.
- **Form** (`SwapForm`): dark ink bottom sheet (radius 20), 2-step:
  - Step 1 "Pilih hari lo yang mau ditukar" — chips hari piket milik user (`available-days`). Lanjut.
  - Step 2 "Mau tukar sama hari siapa?" — daftar hari anggota lain (`target-days`): `{formatWeekdayDate} · {nama}`. Tombol "← Ganti hari lo" kembali ke step 1. Ajukan.
- **Incoming card**: "Request masuk" + waktu relatif; dua `DayBox` (tanggal mono + nama, Lo di kanan) dipisah ⇄ pine 20; note "…mau tukar jadwal {tgl} sama jadwal lo {tgl}."; aksi **Terima** (ink) / **Tolak** (outline line).
- **Histori swap** (section "HISTORI SWAP · buat audit"): card "Request lo" + waktu; dua `DayBox`; note sesuai status; stamp (DIAJUKAN mustard / DITERIMA pine / DITOLAK brick).

## 6. Constraints / Prohibited

- Cannot swap off days (Selasa/Kamis).
- Cannot swap to a day already scheduled by someone else.
- No partial-room swap.
- **Timezone (locked 2026-08-08):** `tanggal`/`tanggalKe` stored as `@db.Date` (Prisma persists UTC components). Calendar math uses UTC-midnight dates, resolves "today" by shifting +7h (WIB), and off-day check uses `getUTCDay()`. Same WIB/UTC rule as schedule.

## 7. Dependencies

- Required read: `features/schedule/context.md` (available days), `features/piket/context.md`.

## 8. Status

Not yet implemented (awaiting Phase 2–3).
