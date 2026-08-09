# Feature Context — Piket (Daily Execution)

## 1. Goal & Scope

Daily piket execution flow: per-room **photo before → jenis_piket checklist → photo after → submit**. One submission covers ALL rooms that day. Does not include approval (see verifikasi) or schedule generation (see schedule).

## 2. Data Model

- `Jadwal` (today's schedule for the user).
- `Ruangan` + `JenisPiket` (is_active) — checklist per room.
- `PiketSubmission`: `jadwalId`, `anggotaId`, `status`, `reviewerId?` (assigned reviewer — see verifikasi).
- `RuanganProof`: `submissionId`, `ruanganId`, `fotoBefore?`, `fotoAfter?` (nullable for not-worked rooms), `jenisSelesai[]`.

## 3. API Contract (NestJS)

Module: `piket`.

| Method | Path                 | Request                                                                              | Response                                                    | Notes                                                               |
| ------ | -------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| GET    | `/piket/today`       | —                                                                                    | `{ jadwal, ruangan[], jenisByRuangan, totalJenis, existingSubmission, nominalDenda }` | Full data for the Piket screen. `jadwal.isMine` = today's assignee is the caller; when `jadwal != null && !isMine` the "Piket gw" view shows an empty state "Hari ini giliran {nama}" (no submission UI). `existingSubmission` includes `proofs` (foto + jenisSelesai) so the read-only view renders what was sent. `totalJenis` = active items for the proportional fine. |
| POST   | `/piket/submissions` | `{ jadwalId, proofs: [{ ruanganId, fotoBeforeUrl, fotoAfterUrl, jenisSelesai[] }] }` | `{ submission }`                                            | Upload photos to `/storage` first, then send URLs.                  |
| POST   | `/piket/upload`      | multipart `{ ruanganId, type }`                                                      | `{ url }`                                                   | Upload photo → `photos/{submissionId}/{ruanganId}_{type}_{ts}.jpg`. |

## 4. Business Rules & State Machine

Locked decisions:

- Linear flow per room: photo before → checklist → photo after. Never mixed.
- **Submit validation (locked 2026-08-09):** every active room must appear in the submission. A room with **zero** checked jenis is "not worked" → stored without photos (all items count toward fine). A room with **≥1** checked jenis → server requires both before+after photos + at least one checked jenis. DTO: photos/`jenisSelesai` are optional; the service enforces the rule.
- One day = one submission (per user + jadwal).
- Status: `menunggu` after submit → `approved`/`rejected`/`bolong`.
- Fine shown as remaining denda per unchecked item (proportional) — the amount lives in the risk banner.
- Off days (Selasa/Kamis) or no assigned schedule → empty state, cannot submit.
- **Locked (TBC-1): rejected submission is final — no revision/resubmission; a proportional fine is created.**

## 5. UI Spec (React Native)

Screen: `app/(tabs)/piket.tsx`. Components: `RuanganPiketCard`, `PhotoSlot`, `PiketChecklist`, `SubmitButton`.

- **Top segmented control (locked 2026-08-08):** two views — **"Piket gw"** (daily execution, below) and **"Verifikasi"** (submission review/history). Pill design: container bg `paperDeep`, radius 13, active tab = ink pill (paper text), inactive transparent (inkSoft text). **Verifikasi tab always visible** even on non-piket days (TBC-4 locked).
- **Dynamic kicker (locked 2026-08-08):** header kicker shows the scheduled day + deadline, e.g. `Senin, 27 Jul · deadline 20:00` (mono, `formatWeekdayDate` + " · deadline 20:00"). Uses the piket day's date.
- Header: schedule name + date (mono).
- **Rooms progress header (locked 2026-08-08):** `Semua ruangan` (mono kicker) + `n/N ruangan beres` (mono) above the room cards.
- Per-room card (ordered by `ruangan.urutan`), per `Serumah.html`:
  - Header row: number badge `01` (26×26, `paperDeep` bg, `inkSoft` mono 700), room name (Inter 600 14.5, flex 1), progress `n/jumlah` (mono 10.5 inkSoft).
  - **Collapsible (locked 2026-08-09):** header row is a toggle (chevron). Default expanded; **auto-collapses once the room is complete** (badge turns pine + check circle replaces chevron). Smooth animation = `LayoutAnimation.Presets.easeInEaseOut` for layout + `Animated` opacity fade.
  - **Badge states (locked 2026-08-09):** `paperDeep` = editing/in-progress; **`pine` + green check circle = room complete** (all items + both photos); **`brick` + red X circle = submitted but not worked / partial** (read-only view).
  - **Foto before** section (label "Foto before" mono + "wajib" hint) → full-width dashed slot (72px, `paperDeep`, camera + "+ ambil foto"; filled = `pineSoft` + image preview). Preview = full-screen modal (tap); "Ganti foto" only in edit mode; small X button to clear (edit only).
  - jenis_piket checklist: 22px checkbox (border 2 `inkSoft`, active pine), row separator bottom `paperDeep`, label 13 Inter (active pineDeep 600 + **line-through**).
  - **Foto after** section (same as before).
  - **Read-only after submit (locked 2026-08-09):** room cards render the submitted proof — photos from `existingSubmission.proofs`, checklist reflects `jenisSelesai`, all interactions disabled. Empty photo slots show a **texture stripe pattern** (`textureA`/`textureB`, height 72, border `line`) + text "foto tidak terpasang · karena ga dikerjain" (no camera icon, no button).
- **Submission success card (locked 2026-08-09):** after a successful submit, a card appears at the top — title "Submission terkirim" + note "Semua ruangan lengkap. Nunggu anggota lain verifikasi bukti before/after tiap ruangan." + **"MENUNGGU VERIFIKASI" stamp** (dashed `olive`, rotate -4°, `stampIn` animation).
- Risk banner (bottom, `brickSoft`): **"Denda tersisa"** + `Rp {remainingDenda}` (mono 700 brick); ok state = "Semua ruangan lengkap" + `pineSoft`. `remainingDenda = nominalDenda × unworked / totalJenis` (decreases as items are checked). **After submit it reads from the submitted proofs** (unworked items still shown), not the cleared draft.
- **Submit (locked 2026-08-09):** partial submit allowed. A room with **zero** checked jenis is "not worked" → no photos needed (all its items count toward the fine); a room with **≥1** checked jenis → both before/after photos required (unchecked items still count). Button: "Submit semua ruangan" when all done, else "Submit · denda tersisa". **UI validates before sending** — tapping with missing items shows a `ConfirmDialog` ("Belum lengkap") listing exactly which room/item is missing. Success/error shown via custom `ConfirmDialog` (never `Alert`). Loading while uploading.

## 6. Constraints / Prohibited

- No approval on this screen.
- Photos cannot be retaken after submit.
- **Fine is proportional per unchecked item (locked 2026-08-09):** `denda = nominalDenda × (unworkedItems / totalActiveItems)`, rounded. `nominalDenda` is the "full" fine (all items unworked). Replaces the old flat-per-submission rule.
- Do not show rooms without active jenis.
- **Timezone (locked 2026-08-08):** `jadwal.tanggal` is stored as `@db.Date` (Prisma persists UTC components). "Today" is resolved in WIB (UTC+7) and canonicalized to UTC-midnight so the `/piket/today` lookup matches the stored date. Same WIB/UTC rule as schedule.

## 7. Dependencies

- Required read: `features/schedule/context.md`, `features/verifikasi/context.md`, `features/rumah/context.md` (rooms/jenis).

## 8. Status

In progress (Piket tab built with "Piket gw" / "Verifikasi" segmented view + dynamic kicker). **Seed (2026-08-08):** `packages/db/src/seed.ts` now seeds 3 rooms (Ruang Tamu / Dapur / Kamar Mandi), 6 resolved history submissions (5 approved + 1 rejected → 1 denda), weekend status for week 3–9 Agu (Admin Mawar Minggu `di_kos`), and today's Jadwal (Minggu 9 Agu 2026 → Admin Mawar, no submission yet so the PJ flow can be exercised). Per-date draft state must survive tab switches (React Query cache / Zustand).
