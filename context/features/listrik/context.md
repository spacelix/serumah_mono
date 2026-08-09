# Feature Context — Listrik Tambahan

## 1. Goal & Scope

Extra electricity token purchases mid-month (self-record). Cost split equally to all members and adjusts next month's `listrik_wajib` iuran. No approval — anyone can upload.

## 2. Data Model

- `PembayaranListrik`: `rumahId`, `anggotaId`, `bulan`, `nominal`, `buktiBayar`, `keterangan`.
- Effect on `IuranBulanan.listrik_wajib` the following month (see iuran).

## 3. API Contract (NestJS)

Module: `listrik`.

| Method | Path                     | Request                                     | Response                                          | Notes                                                                                     |
| ------ | ------------------------ | ------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| GET    | `/listrik?bulan=YYYY-MM` | —                                           | `{ records, nameMap, total, myBought, nAnggota }` | Current month by default.                                                                 |
| POST   | `/listrik`               | `{ bulan, nominal, keterangan?, buktiUrl }` | `{ record }`                                      | Direct insert (self-record). Proof uploaded first → `photos/listrik/{id}/bukti_{ts}.jpg`. |

## 4. Business Rules & State Machine

Locked decisions:

- Self-record — NO status/approval. Direct insert.
- Split: `share = floor(nominal / n_anggota)` per record.
- **Next-month adjustment** (current month vs previous month):
  - Buyer: credit (`nominal − share`) on `listrik_wajib`.
  - Non-buyer: increased by `share`.
  - Per record floored, clamp ≥ 0, total preserved.
  - `listrik_wajib` processed even when base cost is 0 as long as records exist.
- No approval needed — anyone can upload (locked decision).
- Notify all: "A beli listrik RpX — tagihan lo +RpY bulan depan".

## 5. UI Spec (React Native)

Tab **Tagihan → Listrik** (segment 3). Components: `ListrikRecordCard`, `ListrikFormSheet`.

- Month picker in header (shares `selectedMonth` with Denda/Iuran).
- Summary: "total belanja listrik tambahan" + progress bar ("RpX dibeli lo · sisanya anggota lain").
- Split note: "Listrik tambahan RpX dibagi rata: tagihan lo **+RpY** bulan depan" (pine) / credit (brick).
- Record list: avatar + name + date + amount + proof thumbnail. Tap → detail sheet (split `RpX ÷ N orang = RpY/orang`, next-month effect, full proof).
- CTA **"Tambah Record Beli Listrik"** → form: amount (currency), optional note, MANDATORY photo proof, save active when complete.

## 6. Constraints / Prohibited

- No status/approval — no confirm buttons.
- Do not compute splits in the UI — read from the API.
- Unrelated to galon (galon has no amount — locked decision).
- **Timezone (locked 2026-08-08):** `bulan` is stored as `@db.Date` (Prisma persists UTC components). Month math uses UTC-midnight dates — `monthFromString("YYYY-MM")` → `Date.UTC(y,m-1,1)`, and "now" (default month) is resolved by shifting +7h (WIB) before reading UTC components. Same rule as schedule/dashboard services.

## 7. Dependencies

- Required read: `features/iuran/context.md` (adjustment effect), `features/denda/context.md` (shared month picker).

## 8. Status

Not yet implemented (awaiting Phase 2–3).
