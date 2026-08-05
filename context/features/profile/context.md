# Feature Context — Profile

## 1. Goal & Scope
View & edit the user's profile: name, photo, role badge, address, emergency contact. Shows rumah info (read-only) + link to Rumah Management (admin only).

## 2. Data Model
- `Anggota`: `nama`, `fotoProfil`, `kamar`, `kontakDarurat`, `alamat`, `role`, `rumahId`.
- `Rumah` (name, address — read-only).

## 3. API Contract (NestJS)
Module: `anggota` (profile).

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/anggota/me` | — | `{ anggota, rumah }` | Profile detail + rumah info. |
| PATCH | `/anggota/me/profile` | `{ nama?, fotoProfil?, kontakDarurat?, alamat? }` | `{ anggota }` | Update sent fields. |
| POST | `/storage/avatar` | multipart | `{ url }` | Upload avatar → `profiles/{anggota_id}/avatar.jpg`. |

## 4. Business Rules & State Machine
Locked decisions:
- Role badge determined server-side (admin/anggota) — client cannot change.
- Profile photo optional.
- Logout clears the client session (not profile scope but accessible from here).

## 5. UI Spec (React Native)
Screen: `app/profile.tsx` (from the avatar chip on Beranda).

- Header: avatar (100px circle + camera overlay), name, role badge (`tag-done` for admin / `tag-plan` for member).
- Form: name, address, emergency contact (+ kamar if present).
- Rumah info: kos name + address (read-only card).
- **"Simpan"** button.
- **"Kelola Kos"** link → Rumah Management (admin only).
- **Logout** (inkSoft text button).

## 6. Constraints / Prohibited
- No member/rumah management here (in rumah).
- Role cannot be changed by the user.

## 7. Dependencies
- Required read: `features/onboarding/context.md`, `features/rumah/context.md`.

## 8. Status
Not yet implemented (awaiting Phase 2–3).
