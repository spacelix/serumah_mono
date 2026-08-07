# Feature Context — Iuran Bulanan

## 1. Goal & Scope

Monthly iuran bills (Sewa, WiFi, Listrik Wajib) with TOTAL cost per rumah auto-split to members. Payment proof upload (one proof for all categories), PJ confirmation, and monthly pelunasan by the PJ.

## 2. Data Model

- `Rumah`: `biayaKos`, `biayaWifi`, `biayaListrikWajib` (TOTAL/month), `rekeningBank/Nomor/Nama`.
- `IuranBulanan`: `anggotaId`, `bulan` (first of month), `kategori`, `label`, `nominal`, `status`, `buktiBayar`. Unique `(anggotaId, bulan, kategori)`.
- `PelunasanBulanan`: `rumahId`, `bulan`, `kategori`, `buktiLunas`, `createdById`. Unique `(rumahId, bulan, kategori)`.
- `PembayaranListrik` (affects current-month `listrik_wajib` amount).

## 3. API Contract (NestJS)

Module: `iuran`.

| Method | Path                        | Request                           | Response                          | Notes                                                                                                                                                                      |
| ------ | --------------------------- | --------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/iuran?bulan=YYYY-MM`      | —                                 | `{ iuranList, pelunasan, rumah }` | For that month, all members of one rumah + pelunasan.                                                                                                                      |
| POST   | `/iuran/ensure-bulan`       | `{ bulan }`                       | `{ created, updated }`            | Generate/repair iuran per member × 3 categories. Idempotent.                                                                                                               |
| POST   | `/iuran/upload-bukti-total` | `{ bulan, buktiUrl }`             | `{ status }`                      | Update `buktiBayar` + status for ALL `belum_bayar` iuran of the user that month. **PJ/Admin → `lunas` directly**; member → `menunggu_konfirmasi`. Error if nothing to pay. |
| POST   | `/iuran/:id/confirm-lunas`  | — (admin)                         | `{ iuran }`                       | Set `lunas`.                                                                                                                                                               |
| POST   | `/iuran/pelunasan`          | `{ bulan, kategori, buktiLunas }` | `{ pelunasan }`                   | Admin. Upsert per (rumah+bulan+kategori).                                                                                                                                  |

Storage: proof → `photos/iuran/bukti_total/{bulan}_{ts}.jpg`; pelunasan → `photos/iuran/pelunasan/{bulan}_{kategori}_{ts}.jpg`.

## 4. Business Rules & State Machine

Locked decisions:

- Costs are TOTAL mandatory per month — system auto-splits `floor(total/n)`, remainder rotated between members each month (offset = bulan_index % n) for fairness.
- 1 proof upload is enough for all categories (transfers are usually total). Status: `belum_bayar` → `menunggu_konfirmasi` → `lunas`.
- **PJ/Admin's own proof → directly `lunas`** (no self-confirmation).
- Only PJ confirms lunas (no peer approval).
- **Extra electricity** (previous month): buyer gets credit (`nominal − share`), non-buyer increased (`share = floor(nominal/n)`), clamp ≥ 0, processed even when base cost is 0 as long as records exist.
- `ensure-bulan` updates nominal ONLY while still `belum_bayar`.
- Month filter: dropdown default current month.

## 5. UI Spec (React Native)

Tab **Tagihan → Iuran Bulanan** (segment 2). Components: `IuranTotalCard`, `Stamp`.

- Month picker in header.
- **1 total card** (deviation from prototype, locked decision): header receipt icon + "Iuran Bulanan — {bulan}" + total of all the user's categories (mono 22px; brick when any unpaid, inkSoft when paid) + sub "Rp {total semua kategori} ÷ {n} anggota aktif" + combined stamp + chevron expand.
  - Expanded → per-category detail: icon (home/wifi/bolt), label, amount, small stamp, action (Lihat Detail / pending note).
- **"Upload Bukti Bayar"** button (pine) below the card — only if any category is `belum_bayar`.
- Admin approval section "Perlu konfirmasi dari lo" + badge `N nunggu` — per-member card (proof thumbnail) + **Lunas**/**Lihat** buttons.
- **Pelunasan Bulanan** section per category: PJ uploads/replaces the total-payment proof, non-admin views.
- Rekening info: "Bayar ke: [Bank] [Nomor] a.n. [Nama]" when filled.

## 6. Constraints / Prohibited

- No peer approval.
- Client cannot fill in the amount — computed server-side.
- No `addon` category (galon does not create iuran — locked decision).
- Do not show per-category upload — one total proof.

## 7. Dependencies

- Required read: `features/listrik/context.md`, `features/rumah/context.md`, `features/denda/context.md` (shared month picker).

## 8. Status

Not yet implemented (awaiting Phase 2–3).
