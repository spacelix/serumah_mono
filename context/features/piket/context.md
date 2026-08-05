# Feature Context — Piket (Daily Execution)

## 1. Goal & Scope
Daily piket execution flow: per-room **photo before → jenis_piket checklist → photo after → submit**. One submission covers ALL rooms that day. Does not include approval (see verifikasi) or schedule generation (see schedule).

## 2. Data Model
- `Jadwal` (today's schedule for the user).
- `Ruangan` + `JenisPiket` (is_active) — checklist per room.
- `PiketSubmission`: `jadwalId`, `anggotaId`, `status`.
- `RuanganProof`: `submissionId`, `ruanganId`, `fotoBefore`, `fotoAfter`, `jenisSelesai[]`.

## 3. API Contract (NestJS)
Module: `piket`.

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/piket/today` | — | `{ jadwal, ruangan[], jenisByRuangan, existingSubmission }` | Full data for the Piket screen. |
| POST | `/piket/submissions` | `{ jadwalId, proofs: [{ ruanganId, fotoBeforeUrl, fotoAfterUrl, jenisSelesai[] }] }` | `{ submission }` | Upload photos to `/storage` first, then send URLs. |
| POST | `/piket/upload` | multipart `{ ruanganId, type }` | `{ url }` | Upload photo → `photos/{submissionId}/{ruanganId}_{type}_{ts}.jpg`. |

## 4. Business Rules & State Machine
Locked decisions:
- Linear flow per room: photo before → checklist → photo after. Never mixed.
- Submit validation (server-side): every room requires before+after photo + at least 1 checked jenis. Rooms with no active jenis are not required.
- One day = one submission (per user + jadwal).
- Status: `menunggu` after submit → `approved`/`rejected`/`bolong`.
- Fine is NOT shown per checklist item (flat per submission) — the amount lives in the risk banner.
- Off days (Selasa/Kamis) or no assigned schedule → empty state, cannot submit.

## 5. UI Spec (React Native)
Screen: `app/(tabs)/piket.tsx`. Components: `RuanganPiketCard`, `PhotoSlot`, `PiketChecklist`, `SubmitButton`.

- Header: schedule name + date (mono).
- Per-room card (ordered by `ruangan.urutan`):
  - Room number badge.
  - **Foto Before** slot (dashed placeholder, camera) → preview + retake.
  - jenis_piket checklist (custom 22px checkbox; no per-item amount).
  - **Foto After** slot.
  - Progress `n/jumlah` + done-check circle.
- Risk banner (bottom): "Kalau disubmit belum lengkap / ditolak → **Rp {nominal_denda}**" (brick) OR "Semua ruangan lengkap · **Rp 0**" (pine).
- **"Submit semua ruangan"** button (ink, disabled until all complete). Loading while uploading.

## 6. Constraints / Prohibited
- No approval on this screen.
- Photos cannot be retaken after submit.
- Never compute per-jenis fine — always flat per submission.
- Do not show rooms without active jenis.

## 7. Dependencies
- Required read: `features/schedule/context.md`, `features/verifikasi/context.md`, `features/rumah/context.md` (rooms/jenis).

## 8. Status
Not yet implemented (awaiting Phase 2–3). Per-date draft state must survive tab switches (React Query cache / Zustand).
