# To Be Confirmed

Decisions & behaviors **not yet locked** by the user — must be confirmed before working on related features. When an item is confirmed → move the decision into `features/<feature>/context.md` (Business Rules / locked decisions section) + `progress/progress-tracker.md`, then remove it from this file.

**Anti-hallucination rule:** never guess a decision below. If a feature spec references one of these items → STOP & ASK the user with options.

---

## Open (pending confirmation)

| # | Feature | Item | Current State | Options / Question | Priority |
|---|---|---|---|---|---|
| TBC-1 | verifikasi | Rejected piket flow: revision vs auto-fine | **Auto-fine** — reject sets status `rejected`, creates flat fine. No resubmission. Matches design: "rejected → flat fine, not per jenis". | (a) Keep auto-fine (design), or (b) add revision: "Ajukan ulang" button → status `menunggu`, fine deleted, photos can be retaken. | High |
| TBC-2 | verifikasi | Who may review (approve/reject) | Design says "Nunggu diverifikasi — siapa pun anggota bisa" (except sender). | Confirm: any member of the rumah, or locked to admin/PJ only? | High |
| TBC-3 | piket/denda | Photo URL visibility (storage) | Supabase era: `photos` bucket made `public=true` (permanent URLs in DB). MinIO similar. | Confirm: permanent public URLs, or signed URLs + expiry (more private but more complex)? | Medium |
| TBC-4 | verifikasi | Verifikasi tab without today's schedule | Plan: always visible so PJ can review even on non-piket days. | Confirm: always visible, or hidden on off days? | Low |
| TBC-5 | verifikasi | Submission history (approved/rejected) for whom | Plan: all members of the rumah see everyone's history. | Confirm: all see, or restricted (only sender / admin)? | Low |

---

## How to Confirm

- User answers each item (or agrees with the default recommendation).
- After confirmation → update `features/<feature>/context.md` (locked decision), `progress/progress-tracker.md`, then remove the row from this file.
