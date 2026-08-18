# Feature Context — Denda (Fines & Payment)

## 1. Goal & Scope

User fine bills, QRIS payment to PJ/Admin, proof upload, and confirmation. Includes month filtering.

## 2. Data Model

- `Denda`: `anggotaId`, `submissionId?`, `nominal`, `status`, `bayarKeAnggotaId`, `buktiBayar`.
- `PembayaranApproval`: `dendaId`, `approverId`, `status`.
- `Rumah.qrisUrl` — QRIS for fine payment (admin sets, see rumah).

## 3. API Contract (NestJS)

Module: `denda`. Shared month-list endpoint lives in `tagihan` module.

| Method | Path                      | Request        | Response                                     | Notes                                                                                                                                                                            |
| ------ | ------------------------- | -------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/denda?bulan=YYYY-MM`    | —              | `{ qrisUrl, denda: Denda[] }` + member names | Month filter. Each `Denda` adds `origin` (`auto`/`partial`/`rejected`), `reviewerNama`, `tanggal` (jadwal submission), dan `detail: { ruanganNama, fotoBefore, fotoAfter, jenisSelesai[], jenisList[] }[]` — per-room cause for the sheet. `qrisUrl` from `rumah.qrisUrl`. |
| GET    | `/tagihan/months`         | —              | `{ months: string[] }`                       | Distinct WIB months having any tagihan data (piket schedule, denda, iuran, listrik) — descending. Backs the month filter bottom sheet.                                            |
| POST   | `/denda/:id/upload-bukti` | `{ buktiUrl }` | `{ status, receiverId }`                     | Validate owner + status `belum_bayar`. Member → `menunggu_konfirmasi` + `bayarKeAnggotaId` = active PJ of the rumah + `reviewerId` assigned. |
| POST   | `/denda/:id/approve`      | —              | `{ denda }`                                  | **Reviewer-based** (locked 2026-08-18, hapus `@Roles('admin')`): hanya `reviewerId` yang di-assign boleh approve (member→PJ, PJ→round-robin member). Insert `PembayaranApproval` approved + `lunas`. |
| POST   | `/denda/:id/reject`       | —              | `{ denda }`                                  | Reviewer-based (sama). Insert approval rejected + reset `belum_bayar`, `bayarKeAnggotaId` null, `buktiBayar` null.                                                               |

Storage: proof → `photos/denda_bukti/{denda_id}_{ts}.jpg` (upload via `/storage` first, then send URL). **Locked (TBC-3): MinIO bucket is public — DB stores permanent public URLs.**

## 4. Business Rules & State Machine

Locked decisions:

- State: `belum_bayar` → (upload proof) `menunggu_konfirmasi` → (reviewer approve) `lunas`. Reject → back to `belum_bayar`.
- **Reviewer assigned (locked 2026-08-10, diperbaiki 2026-08-18):** member's payment → PJ is reviewer; PJ's own payment → round-robin non-PJ member. Review validasi oleh `denda.reviewerId` (service), **bukan** role admin (sebelumnya `@Roles('admin')` di controller menolak reviewer non-admin — bug).
- Payment ALWAYS goes to the PJ/Admin of the rumah (not peer approval — locked decision item 27).
- **Fine amount is proportional (locked 2026-08-09):** `denda = rumah.nominal_denda × (unworkedItems / totalActiveItems)`, rounded — set when the submission is rejected (PiketService). `nominal_denda` is the "full" fine (nothing worked). Auto-fine (bolong, no submission) still charges the full `nominal_denda`.
- Month filter = shared `MonthPicker` (bottom sheet "Pilih bulan", see UI spec 5) showing only months with data — default current month, history visible.
- Approver auto = PJ/Admin — only the PJ sees the "Perlu konfirmasi dari lo" section.

## 5. UI Spec (React Native)

Tab **Tagihan → Denda** (segment 1). Components: `BillCard`, `Stamp`.

- Month filter (`MonthPicker`, shared across segments): pill trigger showing the active month; tap opens a **bottom sheet "Pilih bulan"** (riseIn 0.24s) listing **only months that have data** (piket schedule/denda/iuran/listrik, from `GET /tagihan/months`) + the current month. Rows show month name + status label mono uppercase: `Bulan ini` / `Riwayat` / `Belum jalan`. Active month = ink bg + paper text.
- Summary card: "Belum lunas / {n} tagihan aktif / **Rp X**" (brick, mono).
- Fine card (`BillCard`): title `Denda piket`, meta line **origin-driven**, status stamp (Lunas pine / Belum Bayar brick / Menunggu olive dashed), amount mono brick 26px.
  - Meta line (`dendaNote`, format `Rab, 22 Agu · <asal>`):
    - `origin == 'auto'` (piket tak dikerjakan, auto-fine): `· auto-denda deadline 20:00`.
    - `origin == 'partial'` (approve tapi ada jenis_piket tak dicentang): `· direview {reviewerNama}`.
    - `origin == 'rejected'` (direject PJ): `· direject {reviewerNama}`.
  - **Ketuk card denda milik sendiri → bottom sheet `DendaDetailSheet`** (animationType slide): header (Denda piket + meta), amount mono brick 28px, **penyebab** card (auto → "Piket nggak dikerjain"; rejected → "Piket ditolak {reviewer}"; partial → "Piket di-approve · sisa {reviewer}") + per-room cards (`ruanganNama` + `{jenisSelesai}/{jenisList}` + jenis chips ✓ pine / × brick dari `denda.detail`), lalu **QRIS di atas sheet** (`rumah.qrisUrl`, `mediaSource`+token) + hint, dan **tombol "Upload Bukti Bayar" di bawah sheet** (kamera → `uploadProof('denda-bukti')` → `POST /denda/:id/upload-bukti`).
  - `belum_bayar`: **QRIS-only** — card tidak punya tombol inline; hint "Ketuk buat lihat penyebab & bayar QRIS" → buka sheet di atas. No "bayar ke teman" dan **no "Sudah Bayar Cash"** — peer payment tidak ada, pembayaran hanya via QRIS (locked decision item 27).
  - `menunggu_konfirmasi`: MENUNGGU KONFIRMASI stamp, note "nunggu konfirmasi PJ".
  - `lunas`: LUNAS stamp.
- Approval section (mustard-soft bg) "Konfirmasi bayar" — for PJ: card `{nama} udah bayar` (bukti transfer QRIS) + **Approve**/**Reject** buttons + tap to view proof. No cash claims.
- Empty state: "Tidak ada denda untuk {bulan}".

## 6. Constraints / Prohibited

- No peer approval — only PJ/Admin.
- Never trust client status — transitions go through the service.
- **Timezone (locked 2026-08-08):** the `?bulan=YYYY-MM` filter is a **WIB calendar month** over `createdAt` (timestamptz). Range built from UTC-midnight − 7h (`Date.UTC(y,m,1) − 7h` … `Date.UTC(y,m+1,1) − 7h`). Same WIB/UTC rule as schedule/iuran.

## 7. Dependencies

- Required read: `features/verifikasi/context.md` (fine origin), `features/rumah/context.md` (QRIS).

## 8. Status

Not yet implemented (awaiting Phase 2–3).
