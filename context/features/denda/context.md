# Feature Context — Denda (Fines & Payment)

## 1. Goal & Scope

User fine bills, QRIS payment to PJ/Admin, proof upload, and confirmation. Includes month filtering. PJ/Admin's own fines auto-paid on proof upload.

## 2. Data Model

- `Denda`: `anggotaId`, `submissionId?`, `nominal`, `status`, `bayarKeAnggotaId`, `buktiBayar`.
- `PembayaranApproval`: `dendaId`, `approverId`, `status`.
- `Rumah.qrisUrl` — QRIS for fine payment (admin sets, see rumah).

## 3. API Contract (NestJS)

Module: `denda`.

| Method | Path                      | Request        | Response                                     | Notes                                                                                                                                                                            |
| ------ | ------------------------- | -------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/denda?bulan=YYYY-MM`    | —              | `{ qrisUrl, denda: Denda[] }` + member names | Month filter. `qrisUrl` from `rumah.qrisUrl` for the "Show QRIS" button.                                                                                                         |
| POST   | `/denda/:id/upload-bukti` | `{ buktiUrl }` | `{ status, receiverId }`                     | Validate owner + status `belum_bayar`. **PJ/Admin → status directly `lunas`** (receiverId = self). Member → `menunggu_konfirmasi` + `bayarKeAnggotaId` = active PJ of the rumah. |
| POST   | `/denda/:id/approve`      | — (admin)      | `{ denda }`                                  | Insert `PembayaranApproval` approved + `lunas`.                                                                                                                                  |
| POST   | `/denda/:id/reject`       | — (admin)      | `{ denda }`                                  | Insert approval rejected + reset `belum_bayar`, `bayarKeAnggotaId` null, `buktiBayar` null.                                                                                      |

Storage: proof → `photos/denda_bukti/{denda_id}_{ts}.jpg` (upload via `/storage` first, then send URL). **Locked (TBC-3): MinIO bucket is public — DB stores permanent public URLs.**

## 4. Business Rules & State Machine

Locked decisions:

- State: `belum_bayar` → (upload proof) `menunggu_konfirmasi` → (PJ approve) `lunas`. Reject → back to `belum_bayar`.
- **PJ/Admin's own fine → proof upload directly `lunas`** (no self-confirmation).
- Payment ALWAYS goes to the PJ/Admin of the rumah (not peer approval — locked decision item 27).
- **Fine amount is proportional (locked 2026-08-09):** `denda = rumah.nominal_denda × (unworkedItems / totalActiveItems)`, rounded — set when the submission is rejected (PiketService). `nominal_denda` is the "full" fine (nothing worked). Auto-fine (bolong, no submission) still charges the full `nominal_denda`.
- Month filter: dropdown default current month, can view history.
- Approver auto = PJ/Admin — only the PJ sees the "Perlu konfirmasi dari lo" section.

## 5. UI Spec (React Native)

Tab **Tagihan → Denda** (segment 1). Components: `BillCard`, `Stamp`.

- Month picker in header (`‹ bulan ›`).
- Summary card: "Belum lunas / {n} tagihan aktif / **Rp X**" (brick, mono).
- Fine card (`BillCard`): reason, meta (date), status stamp (Lunas pine / Belum Bayar brick / Menunggu olive dashed), amount mono brick 26px.
  - `belum_bayar`: 2 buttons — **"Show QRIS"** (show `rumah.qrisUrl`) + **"Upload Bukti"**.
  - `menunggu_konfirmasi`: MENUNGGU KONFIRMASI stamp, note "nunggu konfirmasi PJ".
  - `lunas`: LUNAS stamp.
- Approval section (mustard-soft bg) "Perlu konfirmasi dari lo" — for PJ: claim card `{nama} bayar Rp X` + **Approve**/**Reject** buttons + tap to view proof.
- Empty state: "Tidak ada denda untuk {bulan}".

## 6. Constraints / Prohibited

- No peer approval — only PJ/Admin.
- Fine detail (bottom sheet) is NOT used (locked decision) — card shows status + payment button directly.
- Never trust client status — transitions go through the service.
- **Timezone (locked 2026-08-08):** the `?bulan=YYYY-MM` filter is a **WIB calendar month** over `createdAt` (timestamptz). Range built from UTC-midnight − 7h (`Date.UTC(y,m,1) − 7h` … `Date.UTC(y,m+1,1) − 7h`). Same WIB/UTC rule as schedule/iuran.

## 7. Dependencies

- Required read: `features/verifikasi/context.md` (fine origin), `features/rumah/context.md` (QRIS).

## 8. Status

Not yet implemented (awaiting Phase 2–3).
