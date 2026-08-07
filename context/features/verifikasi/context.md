# Feature Context — Verifikasi (Piket Approval)

## 1. Goal & Scope
Review & approval of piket submissions. One submission is judged whole (all-or-nothing): approve all or reject all. Reject → flat fine. Includes resolved history.

## 2. Data Model
- `PiketSubmission` (status: menunggu/approved/rejected/bolong).
- `PiketApproval`: `submissionId`, `status`, `reviewerId`, `reviewedAt`.
- `RuanganProof` + `Ruangan` (per-room evidence for review).
- `Denda` (created on reject).

## 3. API Contract (NestJS)
Module: `piket` (approval part).

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/piket/submissions?status=pending|resolved` | — | Submission list + member names + per-room evidence. Pending sorted date asc, resolved desc. |
| POST | `/piket/submissions/:id/approve` | — | `{ submission }` | Validate not own submission + same rumah. Insert `PiketApproval` approved. |
| POST | `/piket/submissions/:id/reject` | — | `{ submission, denda }` | Insert `PiketApproval` rejected + create `Denda` flat `rumah.nominal_denda`. |

## 4. Business Rules & State Machine
Locked decisions:
- **Approval per submission, not per room/jenis** — all or nothing.
- Reject → auto flat fine `rumah.nominal_denda` (not per jenis).
- Who may review: **only Admin/PJ Kos** (TBC-2 locked). Other members are read-only; the sender never reviews their own.
- Reviewer cannot approve their own submission (server-side).
- Bolong (auto-fine) is not part of the review UI — only appears as history.
- **Verifikasi tab always visible**, even on non-piket days (TBC-4 locked).
- **History visible to all members** of the rumah (TBC-5 locked).

Locked data decisions (shared with denda/piket):
- **TBC-1**: reject sets status `rejected` + creates flat fine. No resubmission/revision.
- **TBC-3**: MinIO photo bucket is **public** — DB stores permanent public URLs (no signed/expiry).

## 5. UI Spec (React Native)
Tab **Verifikasi** (can be a section/tab inside the Piket tab). Component: `SubmissionReviewCard`.

- Card header: `{nama} · {Hari, tgl}` + "Nunggu diverifikasi" + `{n} ruangan`.
- **Approve** (pine) / **Reject** (brick outline) buttons + preview "Tolak → denda **Rp X**".
- Own submission: text "Ini piketmu sendiri — nunggu diverifikasi PJ Kos." (no buttons).
- Resolved: DISETUJUI/DITOLAK stamp + result banner.
- "Bukti per ruangan" section: per-room card — BEFORE/AFTER slots (68px) + checked jenis chips.

## 6. Constraints / Prohibited
- Review is **Admin/PJ only** (locked TBC-2) — server enforces role; anggota are read-only.
- Never allow reviewing submissions from another rumah.
- Reject = instant fine, no confirmation dialog (deliberate action).
- No revision flow (locked TBC-1) — reject is final, fine is created.

## 7. Dependencies
- Required read: `features/piket/context.md`, `features/denda/context.md`.

## 8. Status
Not yet implemented. **TBC-1, TBC-2, TBC-4, TBC-5 locked; TBC-3 locked (public URLs) on 2026-08-06.**
