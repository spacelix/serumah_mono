# Progress Tracker

Update after every completed feature. Any agent reading this should immediately know: what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** M5 — Mobile: Main Tabs (IN PROGRESS)

**Session 2026-08-10 (notifications) — Plan FCM push locked (docs-first, belum implement):** notif hanya yang butuh approver + pengingat wajib. Skenario: (A) piket reminder cron pagi 07/siang 12/sore 17/19:50 ke yang piket hari itu (skip jika sudah submit); (B) reviewer/approver event-driven (submission piket, swap masuk, **swap diterima/ditolak → pengaju**, bukti denda/iuran); (B2) **galon**: confirm → notif "sudah beli" ke semua anggota + nudge ke member giliran berikutnya (tombol bel → `POST /galon/nudge`); (C) denda mingguan Senin 08:00 ke yang `belum_bayar`; (D) iuran bulan depan cron **hari terakhir bulan** 08:00 (generate `ensureBulan` bulan berikutnya dulu). Stack: FCM HTTP v1 (JWT service account, tanpa SDK) + expo-notifications. DB: `Anggota.pushToken` + `pushTokenUpdatedAt` (migrasi `add_push_token`). API: `POST/DELETE /push/token`, `POST /galon/nudge`, `modules/fcm/`, `modules/notifications/`. Docs: `features/notifications/context.md` (baru), routing map, data-model. **Selanjutnya:** implement item 1 (schema + token endpoint).

**Session 2026-08-10 (notifications) — FCM push diimplementasi (menunggu verify + migrate):** stack FCM HTTP v1 (`modules/fcm/` FcmService — JWT RS256 via webcrypto, kirim ke FCM atau relay Expo utk `ExponentPushToken[...]`, token basi di-clear) + `expo-notifications` (SDK 57, `lib/notifications.ts`, plugin app.json channel "serumah", register token saat `stage==='ready'`, deep-link ke tab, clear token saat logout). DB `Anggota.pushToken`+`pushTokenUpdatedAt` (migrasi `add_push_token`). API: `POST/DELETE /push/token`, `POST /galon/nudge`. `NotificationsService` (scenario senders) + `NotificationsCronService`: (A) piket reminder `0 7/12/17/50 19 * * *` ke yang piket hari itu, skip sudah submit; (C) denda mingguan `0 8 * * 1`; (D) iuran bulan depan `0 8 28-31 * *` + guard last-day + `IuranService.ensureBulanForRumah`. Hooks event-driven: piket submit→reviewer, swap create→penerima + accept/reject→pengaju, denda/iuran upload-bukti→reviewer, galon confirm→semua anggota + nudge next + tombol bel `apiNudgeGalon`. **Belum di-verify (butuh Prisma regenerate pushToken) + belum commit.**

**Session 2026-08-10 (swap) — Swap jadi mutual 2-hari + UI redesign:** `SwapRequest` + `tanggalKe` (migration `swap_mutual_two_day`). `POST /swap` kini `{ tanggal, tanggalKe, keAnggotaId }` — validasi `tanggal` = hari piket milik pengaju & `tanggalKe` = hari piket milik penerima. `accept` **saling memindahkan kedua jadwal** (tanggal: dari→ke; tanggalKe: ke→dari); tolak jika salah satu hari sudah ada submission. Endpoint baru `GET /swap/target-days` → `{ id, nama, days[] }[]` (anggota lain + hari piket mereka, 2 minggu ke depan). UI `swap.tsx` di-rebuild per Serumah.html: header kicker "All-or-nothing · 1 hari penuh"; CTA dashed "Ajukan swap baru" (hilang saat form terbuka); form **dark bottom sheet 2-step** (step 1 pilih hari lo dari `available-days` → step 2 pilih hari anggota lain dari `target-days`, tombol "← Ganti hari lo"); kartu incoming "Request masuk" + waktu relatif + dua `DayBox` (tanggal mono + nama, Lo di kanan) + ⇄ pine + note + Terima(ink)/Tolak(outline); section **Histori swap** ("buat audit") kartu "Request lo" + stamp status. `members.ts` (useIuranMembers) dihapus — digantikan `useSwapTargets`.

**Session 2026-08-09 (h) — tap-on-backdrop closes every bottom sheet:** all slide bottom sheets (`SubmissionReviewSheet` piket, `DendaDetailSheet` + `MonthSheet` tagihan, `MemberDetailSheet` kelola rumah) now close by **tapping the dark backdrop area above** — backdrop is a `Pressable` with `onPress={close}`, sheet body is a `View` with `onStartShouldSetResponder={() => true}` so taps inside the sheet don't bubble to the backdrop. Android back button (`onRequestClose`) already worked. (Splash + member detail = session g below.)

**Session 2026-08-09 (g) — detail anggota bottom sheet + splash fix:** `GET /rumah/me` now returns `kontakDarurat` + `alamat` per member; `RumahManageMember` type extended; **member row in Kelola Rumah is pressable (all members)** → opens **"Detail anggota" bottom sheet** (`MemberDetailSheet`, slide modal matching DendaDetailSheet pattern): avatar 48px + nama + role + "Bergabung {tanggal}" + info card showing **Kontak darurat** & **Alamat** (dash when empty). **Member remove moved into the sheet** — inline `⋯` row button removed; admin sees a **"Hapus anggota"** button (brick outline) on non-admin member sheets → ConfirmDialog. Locked decision: any member may view another member's contact/address (boarding-house need). **Splash fix (`app/_layout.tsx`)**: `SerumahSplash` was mounted behind the hidden native splash so its riseIn/wordmark finished invisibly — now a plain green `splashBackdrop` renders during load, `SerumahSplash` mounts fresh at reveal (after `hideAsync` via rAF) and is held 2400ms so wordmark/kicker/version read.

**Session 2026-08-09 (f) — password show/hide toggle + keyboard-cover fixes:** `SerumahInput` gets a right-side **eye / eye-off toggle** (lucide `Eye`/`EyeOff`, `accessibilityLabel` "Tampilkan password"/"Sembunyikan password", `paddingRight` 44) whenever `secureTextEntry` — covers Login + Register password fields automatically. Profile "Ganti password" card rebuilt with a `PasswordField` component (same toggle) replacing the 3 raw inputs. All centered auth/onboarding screens (`login`, `register`, `onboarding/profile`, `onboarding/create-rumah`, `onboarding/join-rumah`) now use `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` on their `KeyboardAvoidingView` (Android edge-to-edge previously ignored `padding`/`undefined` → keyboard covered the inputs). Scroll-based screens with inline inputs — Kelola Rumah (`Tambah Ruangan` / add-jenis), Profile (Ganti password), Tagihan (listrik record form) — get a wrapping `KeyboardAvoidingView` + `keyboardShouldPersistTaps="handled"` so taps land on buttons behind an open keyboard. Docs: auth + rumah + profile contexts updated. Mobile typecheck green (hand to user for full build verification).

**Session 2026-08-09 (e) — subscreen slide, piket isMine fix, QRIS upload, denda detail sheet:** Root `Stack` gets `animation: 'slide_from_right'` **scoped to `profile` + `rumah/manage`** (masuk subscreen slide kanan→kiri, back kiri→kanan; tidak global agar tab tidak ikut animasi → menghilangkan glitch saat back). **Piket gw fix:** when `GET /piket/today` returns a jadwal that isn't the caller's (`!isMine`), the "Piket gw" view shows EmptyState "Hari ini giliran {nama}" instead of the submission form (Cici no longer sees Admin Mawar's weekend piket). **QRIS upload input** added to Kelola Rumah (`QrisSection`): thumbnail of `rumah.qrisUrl` for all; "Upload QRIS"/"Ganti QRIS" button admin-only → **pick image dari galeri** (`launchImageLibraryAsync`, bukan kamera) → `uploadProof('qris')` → `PUT /rumah/qris`. **Denda detail sheet:** `GET /denda` now returns `tanggal` + `detail: { ruanganNama, fotoBefore, fotoAfter, jenisSelesai[], jenisList[] }[]` (from the linked submission's proofs). Denda card milik sendiri kini **pressable → `DendaDetailSheet`** (slide modal): penyebab per ruangan (jenis chips ✓ pine / × brick), **QRIS di atas sheet**, tombol **"Upload Bukti Bayar" di bawah sheet** (kamera → `uploadProof('denda-bukti')` → `POST /denda/:id/upload-bukti`, sheet menutup setelah sukses). Inline "Bayar QRIS/Sudah scan & bayar" buttons pada card dihapus.

**Session 2026-08-09 (d) — QRIS-only denda + Kelola Rumah untuk semua member:** `tagihan.tsx` payable card is **QRIS-only** — single "Bayar QRIS" button opens QRIS view, inside "Sudah scan & bayar" (upload bukti transfer) + "Batal"; "Sudah Bayar Cash" removed (no peer/cash payment). PJ approval section renamed "Konfirmasi bayar" (`{nama} udah bayar` via QRIS proof). **Avatar chip (`ScreenHeader`) hidden on sub-screens** (`onBack` present) unless `showAvatar` forced. **Kelola Rumah now open to ALL members**: profile row no longer `isAdmin`-gated (sub text differs by role); non-admin sees detail rumah + members + ruangan/jenis piket **view-only** (all edits, invite row + "Copy kode" admin-only; section title "Ruangan & jenis piket" for non-admin; denda desc updated to proportional wording). Backend already member-open (`GET /rumah/me`, `GET /ruangan`).

**Session 2026-08-09 (c) — Denda card meta origin-driven:** `GET /denda` now returns `origin` (`auto`/`partial`/`rejected`) + `reviewerNama` (last reviewer on the linked `PiketSubmission`). `BillCard` keeps title `Denda piket` with note from new `dendaNote()`: `auto` → `Rab, 22 Agu · auto-denda deadline 20:00`; `partial` (piket dikerja & di-approve tapi ada jenis_piket nggak diceklis) → `Rabi, 22 Agu · direview {nama}`; `rejected` → `Rab, 22 Agu · direject {nama}`.
**Session 2026-08-09 (b) — Tagihan revisions:** segmented control aligned to design (`tagihan.tsx`): track `paperDeep` radius 13, active = **ink** bg + **paper** text, inactive inkSoft. Kicker token resized to 10.5px/.14em; header kicker `Tagihan · {bulan}`. **MonthPicker now below the segmented control, rebuilt as a pill trigger → bottom sheet "Pilih bulan"** (riseIn 0.24s, × close, rows month + status `Bulan ini`/`Riwayat`/`Belum jalan`, active ink bg). **New endpoint `GET /tagihan/months`** (new `modules/tagihan`) → `{ months: string[] }` — only WIB months that have data (jadwal/denda/iuran/listrik) for the rumah, descending. New `useTagihanMonths()` hook + wiring. Denda context & UI spec updated (month filter = bottom sheet listing months with data only).
**Last completed:** M5.5 Profile & Rumah Management — Profile screen (`app/profile.tsx`, avatar edit, role badge, form, rumah info, Kelola Kos link, logout) reached from the Beranda avatar chip; **new rumah management API**: `GET /rumah/me`, `PATCH /rumah/me`, `POST /rumah/reset-invite`, `PUT /rumah/qris`, `DELETE /rumah/anggota/:id` (all admin, server-scoped); `app/rumah/manage.tsx` with InfoCard, Biaya Rumah (edit), Rekening + QRIS, Invite code + reset/copy, member list + remove; **Kelola Rumah rebuild** to match `Serumah.html` (detail/edit rumah with nama/alamat/biaya/rekening inline form, anggota list with "Join <date>" + remove, kelola ruangan & jenis piket with add/rename/remove/reorder); **first-time schedule generation**: `POST /schedule/generate/rest-of-week` (admin, backfills today→Sunday weekday + weekend), **Generate Jadwal card** at bottom of Kelola Rumah (disabled when week complete), and a **PJ reminder banner on Beranda** (`scheduleIncomplete` + `isAdmin` flags) that deep-links with auto-scroll to the generate card. `features/profile/api/profile.ts`. API build/lint/typecheck/test + mobile lint/typecheck green.

**Profile revision (committed):** profile screen rebuilt to match `Serumah.html` (profile card → "Update profil" edit card with rise-in/rise-out animation, fields Email/Nama/Kontak darurat/Alamat, camera avatar, stats `GET /anggota/me/stats`, `PATCH /auth/password`, `POST /rumah/leave`, `GET /anggota/me` now exposes `email`). **`anggota.kamar` removed from schema + API + mobile** (migration `2_remove_kamar`) — rooms to clean are set via `Ruangan`/`JenisPiket`, not a profile field. **Profile foto hapus:** `PATCH /anggota/me/profile` accepts `fotoProfil: null` to clear (DTO + service fixed to preserve `null` vs `undefined`); edit card shows "Hapus foto" when a photo is present. **Avatar upload fresh**: avatar object key is deterministic so its stream URL never changes and expo-image cached the old photo; upload response now appends `?v={ts}` so the new photo renders. **Logout redirect fixed**: root `_layout.tsx` redirects to `/(auth)/welcome` when `stage === 'anonymous'` (profile is a root-level screen outside `(tabs)`/`(auth)` guards).

**Next:** Phase M6 (deferred).

**Session 2026-08-08/09 — Piket tab built (committed/verify pending):** `app/(tabs)/piket.tsx` — **"Piket gw" | "Verifikasi" segmented control** (always visible, TBC-4), **dynamic kicker** (`formatWeekdayDate + " · deadline 20:00"`), rooms progress header, **collapsible room cards** (auto-collapse on complete; `LayoutAnimation` + fade). **Proportional fine (locked):** `remainingDenda = nominalDenda × unworked/totalJenis`, partial submit allowed (room with zero checked jenis = "not worked", no photos; ≥1 checked = both photos required). **Post-submit read-only** view from `existingSubmission.proofs` (photos via `mediaSource`+token, empty slots show `textureA/B` stripes + "foto tidak terpasang · karena ga dikerjain", badge `brick`+red X for not-worked/partial, `pine`+check for complete). **Submission success card** with "MENUNGGU VERIFIKASI" stamp (`olive` dashed, **`stampIn` 0.42s: -14° scale 1.6 → -4° .96 → -4° 1**). All dialogs via custom `ConfirmDialog` (no `Alert`); UI validates per-room before submit. **Reviewer auto-assign (locked):** `PiketSubmission.reviewerId` (migration `add_reviewer_to_piket_submissions`) — PJ reviews member submissions; PJ's own submission → round-robin member reviewer; approve/reject validated by `reviewerId` (not `@Roles('admin')`). `/piket/today` returns `totalJenis` + `existingSubmission.proofs`; DTO photos/jenis optional (service enforces). Seed expanded to 3 rooms + 6 history submissions (1 rejected→denda) + today's Jadwal (Admin Mawar, Minggu 9 Agu).

**Log Viewer & Stats (implemented 2026-08-07):** new feature `features/logviewer` — global `LoggerInterceptor` buffers each request to Redis (`RPUSH log:buffer`), a BullMQ repeatable job flushes every 5 min (`RENAME` claim → `createMany` → restore on failure, `attempts: 3` + exponential backoff) into the new `LogEntry` Postgres table (migration `20260807072819_add_log_entries`); `AdminModule` (`GET /admin` HTML page, `GET /admin/stats`, `GET /admin/logs`) — fully public (`@Public`); same Redis is a **read-cache** (`CacheService`: `dashboard:{rumahId}` + `profile` scopes, TTL 60s, invalidated on galon/schedule/profile mutations, `SCAN`-based invalidation). Requires `REDIS_URL` in `.env` (existing Redis; compose redis intentionally not added). **Review fixes applied:** error status via `instanceof HttpException` (was logging unhandled 500s as 200), admin page HTML-escapes user data (XSS), circular import fixed via `redis.constants.ts`. API build/test/prettier green.

**Session 2026-08-07 (committed):** **Beranda redesigned** to match `Serumah.html` — weekend card (custom pine bg, deadline badge, active Di kos = paper pill, "anggota lain" horizontal scroll, brick warning), galon card (custom droplet SVG `M7.4 13h9.2`, "Giliran: Nama (lo)" via `isMine`, ink pill "Sudah Beli"), billing card (kicker "Tagihan bulan ini", mono amount, "Lihat detail →" → Tagihan), jadwal card (header + week range `27 Jul – 2 Agu`, `formatDayNumber`, `Libur` dashed cards, chips `SEN`/abbrev). API wiring: `getAnggotaLain`/`anggotaId`, `GalonService.current().isMine`, `getScheduleWeek.isMine` + `submissionTag(null)='LIBUR'`, `getBilling` returns `{total,lunas,bulan}`. **Login/Register** use custom `ConfirmDialog` `single` mode instead of `Alert` (demo error for password mismatch too). **Custom bottom nav** (`(tabs)/_layout.tsx`): absolute overlay gradient `paper→transparent`, active = ink pill, icons rendered from **exact design SVG paths** (`components/ui/tab-icon.tsx`) via `react-native-svg` — not lucide. **Kelola Rumah**: leaving after adding a jenis piket shows confirm dialog → `/schedule/refresh-future-rooms` (admin) refreshes `ruangan[]` of future Jadwal rows only. **Docker deploy**: `apps/api/Dockerfile` (multi-stage `oven/bun:1-alpine` → `node:22-alpine`, `bun install --frozen-lockfile --filter @serumah/api`, copies ws set), `docker-compose.yml` (traefik, host `api-serumah.spacelix.qzz.io`, port 3000, no postgres/minio — uses existing DB+MinIO), `.dockerignore` (excludes mobile source but keeps `apps/mobile/package.json`). **All committed & build verified on server.**

> **Deployment notes:** backend deployed to VPS `43.129.40.34` via traefik; `apps/api/.env` on server must be pointed at the existing DB/MinIO and **`REDIS_URL`** — docker-compose now includes a `redis` service (`redis:7-alpine`, appendonly, volume `redis-data`), so server `.env` uses `REDIS_URL=redis://redis:6379` (service name; local dev uses `localhost`); `traefik-public` network must exist (`docker network create traefik-public`).

> **Phase order (user decision):** Release/update pipeline is **M1 — FIRST**, right after scaffold, so in-app updates can be tested & monitored throughout development. After M1, every phase ships an APK through the same update pipeline. Phase sequence: M1 → M3 (backend features) → M4/M5 → M6.

> Migration from **Flutter + Supabase + Riverpod** → **React Native (Expo) + NestJS + PostgreSQL/Prisma + MinIO (React Query + Zustand)**. Locked decisions: monorepo in `/mnt/d/Source/House`, full re-seed from scratch (no supabase data migration, project not live), in-app update stays via GitHub Releases. The old Flutter repo `/mnt/d/Source/serumah` is kept as reference (not the code base).

---

## Progress

### Phase M0 — Documentation & Foundation

- [x] M0.1 Per-feature context split (AGENTS.md + context/core + data-model + 14 features/ + progress/)
- [x] M0.2 Monorepo scaffold
  - [x] Root workspaces + turbo (build/lint/typecheck/test)
  - [x] docker-compose (Postgres 16 + MinIO)
  - [x] packages/db (schema, 0_init migration, seed, builds to dist/)
  - [x] apps/api (Config, PrismaModule, JWT guard, exception filter, MinIO storage, health)
  - [x] apps/mobile (Expo 57 scaffold, React Query + Zustand + axios, lint+typecheck green)

### Phase M1 — Release & In-App Update (FIRST)

- [x] In-app update check + dialog (release mode only)
- [x] GitHub Actions build APK + version.json + release on tag `v*` (signed keystore)
- [ ] Test loop (older APK → new APK → in-app update) per phase

### Phase M2 — Backend Core (NestJS)

- [x] Auth (register/login/JWT)
- [x] Anggota/Profile
- [x] Rumah (create/join/invite)
- [x] Storage service (MinIO + avatar)
- [x] Seed dev data (real bcrypt demo accounts)
- [x] JWT DB-lookup + RolesGuard (verified end-to-end)

### Phase M3 — Backend Features

- [x] Ruangan & Jenis Piket (CRUD + reorder)
- [x] Schedule (round-robin, weekend, freeze, generate)
- [x] Piket (submissions + ruangan_proof)
- [x] Verifikasi & Denda (per-submission approval, QRIS payment)
- [x] Iuran & Listrik (auto-split, total proof, pelunasan, adjust)
- [x] Swap & Galon
- [x] Cron (auto-fine, weekend freeze)
- [x] Update manifest

**Post-build review fixes (2026-08-06):** weekend/daily auto-fine cron no longer gated by `isPiketDay` (any scheduled day is fined; off days have no `Jadwal` so naturally skipped); added admin-guarded `POST /schedule/run-weekend-freeze` + auto `freezeWeekendCron` (Fri 20:00) to generate the weekend roster; aligned `GET /listrik` → `{ records, nameMap, total, myBought, nAnggota }` and `GET /iuran` → `{ iuranList, pelunasan, rumah }` with docs; extracted pure `computeListrikAdjustment` (`src/modules/iuran/iuran.math.ts` + specs) to cover split-credit arithmetic. Full `turbo run build lint typecheck test` green.

### Phase M4 — Mobile: Auth & Onboarding

- [x] Expo theme + router + authStore guard
- [x] Splash, Login, Register
- [x] Onboarding (profile, create rumah, join rumah)

### Phase M5 — Mobile: Main Tabs

- [ ] Beranda (weekend, galon, billing, schedule)
- [ ] Piket (per-room flow)
- [ ] Tagihan (Denda | Iuran | Listrik + month picker)
- [ ] Swap
- [ ] Profile & Rumah Management

### Phase M6 — Final Release & E2E

- [ ] End-to-end testing across all features
- [ ] Final release through the update pipeline
- [ ] Production hardening

---

## Locked Migration Decisions

| #     | Decision      | Detail                                                                                                                                      |
| ----- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Mig-1 | Stack         | RN (Expo) + NestJS + PostgreSQL/Prisma + MinIO, React Query + Zustand.                                                                      |
| Mig-2 | Location      | Monorepo in `/mnt/d/Source/House`. Old Flutter repo `/mnt/d/Source/serumah` kept as reference.                                              |
| Mig-3 | Data          | Full re-seed from scratch — no supabase data export (project not live). Passwords not an issue (argon2→bcrypt).                             |
| Mig-4 | Design        | The "Papan Piket Digital" design system + Bahasa Indonesia fully preserved (tokens → RN theme).                                             |
| Mig-5 | Context       | 1 file per feature (API+UI combined), 8-part template; single shared data-model file. Unlocked TBCs marked explicitly → agent stops & asks. |
| Mig-6 | Server        | Self-hosted NestJS (VPS/Docker) — abandons the "serverless only" principle.                                                                 |
| Mig-7 | App update    | Keep the GitHub Releases flow (`version.json` + APK) for in-app updates.                                                                    |
| Mig-8 | Tooling       | Use **Bun** for project creation & package management; create projects via generators, never hand-write `package.json`.                     |
| Mig-9 | Docs language | All documentation (AGENTS.md + context/) is in **English**. Only the app UI is in Bahasa Indonesia.                                         |

---

## TBC to Confirm

See `context/progress/to-be-confirmed.md`. **All verifikasi/denda TBCs (1–5) locked on 2026-08-06** (auto-fine on reject; review = Admin/PJ only; public photo URLs; Verifikasi tab always visible; history visible to all members). M3 verifikasi feature is now unblocked.
