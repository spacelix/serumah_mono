# To Be Confirmed

Decisions & behaviors **not yet locked** by the user — must be confirmed before working on related features. When an item is confirmed → move the decision into `features/<feature>/context.md` (Business Rules / locked decisions section) + `progress/progress-tracker.md`, then remove it from this file.

**Anti-hallucination rule:** never guess a decision below. If a feature spec references one of these items → STOP & ASK the user with options.

---

## Open (pending confirmation)

None currently open. All TBC-1..TBC-5 (verifikasi/denda) were locked on 2026-08-06.

---

## Resolved (for the record)

| # | Feature | Item | Locked Decision | Date |
|---|---|---|---|---|
| TBC-1 | verifikasi | Rejected piket flow | **Auto-fine** — reject sets `rejected`, creates flat fine. No resubmission. | 2026-08-06 |
| TBC-2 | verifikasi | Who may review | **Admin/PJ only.** Anggota are read-only; sender never reviews own. | 2026-08-06 |
| TBC-3 | piket/denda | Photo URL visibility | **Permanent public URLs** (MinIO bucket public; DB stores permanent URLs). | 2026-08-06 |
| TBC-4 | verifikasi | Verifikasi tab visibility | **Always visible**, even on non-piket days. | 2026-08-06 |
| TBC-5 | verifikasi | Submission history visibility | **All members** of the rumah see everyone's history. | 2026-08-06 |

---

## How to Confirm

- User answers each item (or agrees with the default recommendation).
- After confirmation → update `features/<feature>/context.md` (locked decision), `progress/progress-tracker.md`, then remove the row from this file.
