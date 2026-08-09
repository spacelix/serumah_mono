# Memory — Serumah: Piket tab (proportional fine, reviewer auto-assign), v1.7.0 (2026-08-09)

Last updated: 2026-08-09 (session end)

## What was built

**Piket tab — `app/(tabs)/piket.tsx`** (commits `54edb5e`..`fcd9fcc`, all pushed, tag `v1.7.0`):
- **"Piket gw" | "Verifikasi" segmented control** (always visible, TBC-4), dynamic kicker (`formatWeekdayDate + " · deadline 20:00"`), rooms progress header.
- **Collapsible room cards** (auto-collapse on complete, `LayoutAnimation` + Animated fade), badge states: `paperDeep` (editing) / `pine`+check (complete) / `brick`+X (submitted but not worked/partial).
- **Proportional fine (locked 2026-08-09):** `remainingDenda = nominalDenda × unworked/totalJenis`. Partial submit: room with zero checked jenis = "not worked" (no photos); ≥1 checked = both photos required. UI validates per-room before send (custom `ConfirmDialog` list).
- **Post-submit read-only** view from `existingSubmission.proofs` (photos via `mediaSource`+token; empty slots = `textureA/B` stripes + "foto tidak terpasang · karena ga dikerjain"). Submission success card + "MENUNGGU VERIFIKASI" stamp (`olive` dashed, `stampIn` 0.42s: -14° scale 1.6 → -4° .96 → -4° 1).
- **Reviewer auto-assign (locked):** `PiketSubmission.reviewerId` (migration `add_reviewer_to_piket_submissions` + `add_reviewer_relation`) — PJ reviews member submissions; PJ's own submission → round-robin member reviewer. Approve/reject validated by `reviewerId` (not `@Roles('admin')`).
- **Reject = full flat fine; approve partial = remaining proportional denda.** `listSubmissions` returns `dendaApprove`/`dendaReject`, filtered to **only submissions assigned to / acted on by the logged-in user**.
- **Review UI:** card (header + approve/reject + denda preview + bell-button toast "Notifikasi telah dikirim ke reviewer" for submitter), separate "Bukti per ruangan" cards (chips green-check done / red-X missed), resolved history → clickable card → bottom sheet (proofs + denda + "Terverifikasi oleh {name}" + close X).
- **Global `EmptyState`** component (`components/ui/empty-state.tsx`) applied to beranda/swap/tagihan/piket empty states.
- **Timezone-safe dates** in iuran/listrik/denda/swap (UTC-midnight + WIB offset, same as schedule/dashboard).
- **Seed rewrite:** 3 rooms (Ruang Tamu/Dapur/Kamar Mandi), 6 history submissions (5 approved + 1 rejected → 1 denda), weekend status (Admin Mawar Minggu `di_kos`), today's Jadwal (Minggu 9 Agu → Admin Mawar). Cleaned stray `jenis_piket` row.
- **Denda card meta origin-driven (session 2026-08-09 b):** `GET /denda` (`denda.service.ts`) now returns `origin` (`auto`|`partial`|`rejected`) + `reviewerNama` (last `PiketApproval` reviewer, from linked `submission`). Mobile `BillCard` (`tagihan.tsx`) shows note via new local `dendaNote()`: `auto` → `· auto-denda deadline 20:00`; `partial` → `· direview {nama}`; `rejected` → `· ditolak {nama}`, all prefixed `Rab, 22 Agu` (from `createdAt`). Title stays `Denda piket`; Belum Bayar is QRIS-only (Bayar QRIS + Sudah Bayar Cash) — no "bayar ke teman" (peer payment doesn't exist).

## Decisions made

- **Denda proportional** per unchecked item (replaces flat): `nominalDenda × unworked/totalActiveItems`. **Reject = full** `nominalDenda`; **approve partial = remaining** proportional denda.
- **Reviewer** = PJ for member submissions; round-robin member for PJ's own submission. Only assigned reviewer (`isMyTurn`) can approve/reject.
- **Piket tab** always shows Verifikasi (TBC-4); history visible to all (TBC-5) but `listSubmissions` filters resolved to those the user acted on.
- Version bump policy: major only on breaking change; this release = minor **1.7.0 / versionCode 10**.
- `stampIn` animation (ui-tokens.md Motion): 0.42s, -14° scale 1.6 → -4° .96 → -4° 1 — reuse for all status stamps.

## Problems solved

- `@db.Date` timezone off-by-one (Prisma stores UTC) — fixed via UTC-midnight + WIB offset helpers across schedule/dashboard/iuran/listrik/denda/swap.
- Denda "terlihat di semua riwayat": stray `jenis_piket` row ("Kamar Mandi" UUID) made totalItems=10 vs worked=9 → unworked 1. Cleaned + re-seeded.
- `jenisSelesai` stored IDs vs names — resolved to names via id→name map in backend.
- Empty photo slot (string `''` vs `null`) — UI checks `!uri`, mobile sends `null`.
- `stampIn` exact keyframes (was wrong direction).

## Current state

- **All committed & pushed** to `origin/development`; **tag `v1.7.0` created & pushed** → GitHub Actions builds APK/version.json.
- **UNCOMMITTED (session 2026-08-09 b):** Tagihan tab revisions — MonthPicker rebuilt as pill-trigger → bottom sheet "Pilih bulan", new `GET /tagihan/months` endpoint (`modules/tagihan`), segmented control to design, kicker token 10.5px, BillCard meta now origin-driven (`dendaNote`: `auto`→deadline 20:00, `partial`→`direview {nama}`, `rejected`→`ditolak {nama}`) via new `origin`/`reviewerNama` fields from `GET /denda` + `formatWeekdayDate(createdAt)` prefix. Context docs synced (denda/iuran/listrik month-filter lines, progress-tracker). Awaiting user verification (build/lint/typecheck/test) before commit.
- `memory.md` untracked (not committed).
- Seed + migrations applied locally; API/mobile verified green by user earlier this session.

## Next session starts with

0. **Verify + commit the Tagihan revisions (session 2026-08-09 b, currently uncommitted):** user runs `turbo run build lint typecheck test --filter=@serumah/api` (build `packages/db` first) + `bun run --filter serumah-mobile lint typecheck`; then commit per-item.
1. **Confirm release build** from GitHub Actions for `v1.7.0`; test in-app update on device.
2. Continue **Phase M5**: Tagihan (Denda|Iuran|Listrik + month picker, QRIS, proof upload), Swap tabs — Piket tab is built.
3. If desired, apply the same **proportional-fine + reviewer** patterns to remaining verification/denda screens.

## Open questions

- Phase M6 (E2E/final release) not approved — ask before starting.
