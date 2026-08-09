# Feature Context — Verifikasi (Piket Approval)

## 1. Goal & Scope

Review & approval of piket submissions. One submission is judged whole (all-or-nothing): approve all or reject all. Reject → proportional fine. Includes resolved history.

## 2. Data Model

- `PiketSubmission` (status: menunggu/approved/rejected/bolong) + **`reviewerId?`** (assigned reviewer, migration `add_reviewer_to_piket_submissions`).
- `PiketApproval`: `submissionId`, `status`, `reviewerId`, `reviewedAt`.
- `RuanganProof` + `Ruangan` (per-room evidence for review; `fotoBefore/fotoAfter` nullable for not-worked rooms).
- `Denda` (created on reject, proportional).

## 3. API Contract (NestJS)

Module: `piket` (approval part).

| Method | Path                               | Request   | Response                | Notes                                                                                       |
| ------ | ---------------------------------- | --------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| GET    | `/piket/submissions?status=pending | resolved` | —                       | Submission list + member names + per-room evidence + **`reviewerId`/`isMyTurn`** (whether the caller is the assigned reviewer). Pending sorted date asc, resolved desc. |
| POST   | `/piket/submissions/:id/approve`   | —         | `{ submission }`        | Validate **caller === assigned `reviewerId`** + same rumah (no longer `@Roles('admin')` only). Insert `PiketApproval` approved. |
| POST   | `/piket/submissions/:id/reject`    | —         | `{ submission, denda }` | Same reviewer validation. Insert `PiketApproval` rejected + create `Denda` **proportional** (`nominal_denda × unworked/total`). |

## 4. Business Rules & State Machine

Locked decisions:

- **Approval per submission, not per room/jenis** — all or nothing.
- Reject → auto proportional fine (locked 2026-08-09): `nominal_denda × (unworkedItems / totalActiveItems)`, rounded (see denda/piket).
- Who may review: **only Admin/PJ Kos** for member submissions (TBC-2 locked). **When the PJ submits a piket, the system auto-assigns another member as reviewer via round-robin** (clarified 2026-08-09). The assigned reviewer is stored on `PiketSubmission.reviewerId`; only that reviewer may approve/reject that submission. The sender never reviews their own.
- Reviewer cannot approve their own submission (server-side).
- Bolong (auto-fine) is not part of the review UI — only appears as history.
- **Verifikasi tab always visible**, even on non-piket days (TBC-4 locked).
- **History visible to all members** of the rumah (TBC-5 locked).

Locked data decisions (shared with denda/piket):

- **TBC-1**: reject sets status `rejected` + creates a proportional fine. No resubmission/revision.
- **TBC-3**: MinIO photo bucket is **public** — DB stores permanent public URLs (no signed/expiry).

## 5. UI Spec (React Native)

Tab **Verifikasi** (section inside the Piket tab, "Piket gw" / "Verifikasi" segmented control). Component: `SubmissionReviewCard`.

- Card header: `{nama} · {Hari, tgl}` + "Nunggu diverifikasi" + `{n} ruangan`.
- **Approve** (pine) / **Reject** (brick outline) buttons — shown only when the caller is the **assigned reviewer** (`submission.isMyTurn`) and not their own submission.
- Not the reviewer: read-only text "Menunggu reviewer yang ditugaskan memverifikasi." (or "Ini piketmu sendiri — nunggu diverifikasi." for own submission).
- Resolved: DISETUJUI/DITOLAK stamp + result banner.
- "Bukti per ruangan" section: per-room card — BEFORE/AFTER slots + checked jenis chips (proofs with no photos shown as "not worked").
- Errors (e.g. reject failure) shown via custom `ConfirmDialog` — never `Alert`.

## 6. Constraints / Prohibited

- Review is **only the assigned reviewer** (TBC-2 locked: PJ for member submissions; round-robin member for PJ submissions) — server enforces `reviewerId`; others are read-only.
- Never allow reviewing submissions from another rumah.
- Reject = instant fine, no confirmation dialog (deliberate action).
- No revision flow (locked TBC-1) — reject is final, fine is created.

## 7. Dependencies

- Required read: `features/piket/context.md`, `features/denda/context.md`.

## 8. Status

Not yet implemented. **TBC-1, TBC-2, TBC-4, TBC-5 locked; TBC-3 locked (public URLs) on 2026-08-06.**
