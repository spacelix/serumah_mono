# Feature Context — Rumah (Management + Rooms/Jenis Piket)

## 1. Goal & Scope

Manage the rumah: member list, edit total costs, kos rekening, QRIS for fine payment, invite code (reset), remove member — **admin only for edits, all members for viewing**. Also CRUD **ruangan** + **jenis_piket** per room (admin).

## 2. Data Model

- `Rumah`: `nama`, `alamat`, `biayaKos`, `biayaWifi`, `biayaListrikWajib`, `nominalDenda`, `rekeningBank/Nomor/Nama`, `qrisUrl`, `inviteCode`.
- `Anggota` (member list, role).
- `UndanganKos` (invite code).
- `Ruangan` (`nama`, `urutan`) + `JenisPiket` (`nama`, `isActive`).

## 3. API Contract (NestJS)

Modules: `rumah`, `ruangan`.

| Method | Path                   | Request                                                                                                      | Response                               | Notes                                                   |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------- |
| GET    | `/rumah/me`            | —                                                                                                            | `{ rumah, anggotaList, currentRole }`  | Rumah detail + members (`anggotaList` now also returns `kontakDarurat` + `alamat` per member — all members can view). |
| PATCH  | `/rumah/me`            | `{ biayaKos?, biayaWifi?, biayaListrikWajib?, nominalDenda?, rekeningBank?, rekeningNomor?, rekeningNama? }` | `{ rumah }`                            | Admin only.                                             |
| POST   | `/rumah/reset-invite`  | — (admin)                                                                                                    | `{ inviteCode }`                       | Generate new 6-digit code.                              |
| DELETE | `/rumah/anggota/:id`   | — (admin)                                                                                                    | `{ success }`                          | Set `anggota.rumahId = null`. Does not delete the user. |
| PUT    | `/rumah/qris`          | `{ qrisUrl }`                                                                                                | `{ rumah }`                            | Admin sets/replaces QRIS.                               |
| GET    | `/ruangan`             | —                                                                                                            | `Ruangan[]` + jenis (ordered `urutan`) | All members can view.                                   |
| POST   | `/ruangan`             | `{ nama }`                                                                                                   | `{ ruangan }`                          | Admin. Append `urutan` = max+1.                         |
| PATCH  | `/ruangan/:id`         | `{ nama? }`                                                                                                  | `{ ruangan }`                          | Admin.                                                  |
| POST   | `/ruangan/:id/reorder` | `{ direction: 'up'                                                                                           | 'down' }`                              | `{ ruangan[] }`                                         | Admin. Swap urutan. |
| DELETE | `/ruangan/:id`         | — (admin)                                                                                                    | `{ success }`                          | Cascade delete jenis_piket.                             |
| POST   | `/ruangan/:id/jenis`   | `{ nama }`                                                                                                   | `{ jenisPiket }`                       | Admin.                                                  |
| PATCH  | `/jenis/:id`           | `{ nama?, isActive? }`                                                                                       | `{ jenisPiket }`                       | Admin.                                                  |
| DELETE | `/jenis/:id`           | — (admin)                                                                                                    | `{ success }`                          | Admin.                                                  |

Storage: QRIS → `photos/qris/{rumah_id}_{ts}.jpg` (upload via `/storage`, then PUT qrisUrl).

## 4. Business Rules & State Machine

Locked decisions:

- Rumah costs = **TOTAL per month** (not per person). System auto-splits.
- Admin check (`role='admin'`) server-side for ALL mutations above.
- Non-admin view-only (can view costs/rekening/QRIS, cannot edit).
- Remove member: set `rumahId = null` (not account deletion). When a member leaves → schedules regenerated.
- Invite code: 6 digits, unique, admin reset.
- Only rooms with jenis `is_active=true` appear in the schedule & piket.
- Reorder changes `urutan` (swap with neighbor).

## 5. UI Spec (React Native)

Screen: `app/rumah/manage.tsx` (+ room management inline, not a separate page).

- **"Kelola Rumah" card** (ONE card): header name (Space Grotesk 600 15px) + address + Edit button; invite code box (bg paper radius 13) + **"Copy kode"** (Clipboard) — **invite row admin-only** (hidden for non-admin); **Biaya Rumah** section (4 rows bg paper radius 10 — Biaya Kos, WiFi, Listrik Wajib mono 12px + **Denda Piket** "Rp X" mono brick); **Rekening Kos** section (mustardSoft box radius 10 — "Bank · Nomor" mono 700 13px + "a.n. Nama").
- **QRIS pembayaran section** (below Rumah card): thumbnail `rumah.qrisUrl` (admin or not); **"Upload QRIS" / "Ganti QRIS"** button (admin only, kamera → `uploadProof('qris')` → `PUT /rumah/qris`). Non-admin melihat QRIS (buat bayar denda) tanpa tombol.
- **Member list**: 36px avatar circle + name + role pill + chevron, row pressable (ALL members) → opens **"Detail anggota" bottom sheet** (slide modal): avatar 48px + name + role + "Bergabung {tanggal}" + info card with **Kontak darurat** and **Alamat** (dash `—` when empty). For admin, sheet shows a **"Hapus anggota"** button (brick outline) on non-admin members — no more inline `⋯` in the row; removal confirms via ConfirmDialog. Locked 2026-08-09: any member of the rumah can view another member's `kontakDarurat`/`alamat`.
- **Ruangan & Jenis Piket** (below member list): per-room card — up/down arrows (wire reorder), name (inline edit), jenis chips, inline add-jenis input, **"Tambah Ruangan"** button. **Admin-only for edits; non-admin view-only** (section title becomes "Ruangan & jenis piket", no add/rename/reorder/remove).
- **Edit form**: cost inputs (currency format), denda amount, rekening (bank/number/name), QRIS upload (admin only).
- **Keyboard (locked 2026-08-09):** manage screen ScrollView is wrapped in `KeyboardAvoidingView` (`behavior` = `padding` on iOS / `height` on Android) + `keyboardShouldPersistTaps="handled"` so "Tambah Ruangan" / add-jenis inputs are never covered by the keyboard.
- **Access**: screen reachable from Profile for ALL members (`GET /rumah/me` + `GET /ruangan` are member-open). Non-admin sees detail + members + rooms/jenis read-only.

## 6. Constraints / Prohibited

- Non-admin must not see edit/delete buttons.
- Do not delete the user on member removal — only leave the rumah.
- Room management must NOT be a separate page (locked decision — inline in kelola rumah).

## 7. Dependencies

- Required read: `features/schedule/context.md` (generate after manage), `features/piket/context.md` (rooms/jenis).

## 8. Status

Not yet implemented (awaiting Phase 2–3).
