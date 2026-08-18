# Feature Context — Onboarding

## 1. Goal & Scope

Mandatory flow after register: fill profile → create rumah (become admin) OR join rumah (invite code). Until finished, the user CANNOT access the main app. Scope: initial profile, create rumah, join rumah.

## 2. Data Model

- `User` (`users`) — created in auth.
- `Anggota`: `id` (=User.id), `rumahId`, `nama`, `fotoProfil`, `kontakDarurat`, `alamat`, `role`.
- `Rumah`: `nama`, `alamat`, `inviteCode` (6 digits).
- `UndanganKos`: `rumahId`, `kode`, `dibuatOleh`.

## 3. API Contract (NestJS)

Module: `onboarding` (or `anggota` + `rumah`).

| Method | Path                           | Request                                          | Response                         | Notes                                                                                            |
| ------ | ------------------------------ | ------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------ |
| PUT    | `/anggota/me/profile`          | `{ nama, fotoProfil?, kontakDarurat?, alamat? }` | `{ anggota }`                    | `nama` required. Create/update Anggota.                                                          |
| POST   | `/rumah`                       | `{ nama, alamat }`                               | `{ rumah, inviteCode }`          | Creator becomes `role='admin'`. Auto-generate 6-digit invite code.                               |
| POST   | `/rumah/join`                  | `{ inviteCode }`                                 | `{ rumah }`                      | Validate code. Wrong code → 400 `"Kode undangan tidak valid"`. Set `rumahId` + `role='anggota'`. |
| GET    | `/rumah/join/preview?kode=...` | —                                                | `{ nama, alamat, anggotaCount }` | Preview before confirming join.                                                                  |

## 4. Business Rules & State Machine

Locked decisions:

- Onboarding sequential: **profile → create/join rumah**. Router redirects to `/onboarding/profile` when profile empty, `/onboarding/create-rumah` when rumah empty.
- Rumah creator = `role='admin'`. Joiner via invite = `role='anggota'`.
- Invite code: 6 digits, unique, server-generated. Admin can reset (rumah feature).
- Profile photo optional; uploaded via storage endpoint → `profiles/{anggota_id}/avatar.jpg`.
- **No. telepon darurat + alamat darurat WAJIB (locked 2026-08-12):** `kontakDarurat` dan `alamat` wajib diisi di onboarding — tombol "Lanjut" disabled & validasi alert bila kosong. User yang terlanjur lewat onboarding tanpa keduanya → dashboard expose `profileIncomplete` → modal pengingat di Beranda (ConfirmDialog, "Isi sekarang" → `/profile` / "Nanti").

## 5. UI Spec (React Native)

Screens: `app/onboarding/profile.tsx`, `app/onboarding/create-rumah.tsx`, `app/onboarding/join-rumah.tsx`. No bottom nav.

- **Onboarding Profile**: profile photo (100px circle + camera overlay), name input (required), **no. telepon darurat (required)**, **alamat darurat (required)**. **"Lanjut"** button disabled until semua terisi.
- **Create Rumah**: title **"Buat Kos Baru"**, kos name + address inputs, **"Buat & Dapatkan Kode Undangan"** button. After create: show invite code prominently + **"Bagikan ke temen"** + **"Lanjut ke Beranda"**.
- **Join Rumah**: title **"Gabung Kos"**, 6-digit code input (auto-uppercase). Valid code → preview kos name + address + member count → **"Gabung"** button.

## 6. Constraints / Prohibited

- No profile import/export from other apps.
- No main-tab access before onboarding completes (guard in root layout).
- User cannot pick their own role — determined server-side.

## 7. Dependencies

- Required read: `features/auth/context.md` (session), `features/rumah/context.md` (manage after joining).
- Storage upload: `core/code-standards.md` (path `profiles/`).

## 8. Status

Not yet implemented (awaiting Phase 2–3). See `progress/build-plan.md` — Phase 1 & 2.
