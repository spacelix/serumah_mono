# Progress Tracker

Update after every completed feature. Any agent reading this should immediately know: what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** M5 — Mobile: Main Tabs (IN PROGRESS)
**Last completed:** M5.1 Beranda — new NestJS `DashboardModule` (`GET /dashboard` → `{ weekend, galon, billing, scheduleWeek, memberName }`, injects Schedule+Galon services, weekend freeze flag); mobile `features/dashboard/api` (React Query hooks), `lib/format.ts` (id-ID currency/date), and the Beranda screen with WeekendCard (Di kos/Pulang toggle), GalonWidget (Sudah Beli), BillingSummary, ScheduleList (7 rows + status tags). Mobile lint + typecheck, API build/lint/typecheck/test green.

**Next:** M5.2 Piket (per-room flow).

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

| # | Decision | Detail |
|---|---|---|
| Mig-1 | Stack | RN (Expo) + NestJS + PostgreSQL/Prisma + MinIO, React Query + Zustand. |
| Mig-2 | Location | Monorepo in `/mnt/d/Source/House`. Old Flutter repo `/mnt/d/Source/serumah` kept as reference. |
| Mig-3 | Data | Full re-seed from scratch — no supabase data export (project not live). Passwords not an issue (argon2→bcrypt). |
| Mig-4 | Design | The "Papan Piket Digital" design system + Bahasa Indonesia fully preserved (tokens → RN theme). |
| Mig-5 | Context | 1 file per feature (API+UI combined), 8-part template; single shared data-model file. Unlocked TBCs marked explicitly → agent stops & asks. |
| Mig-6 | Server | Self-hosted NestJS (VPS/Docker) — abandons the "serverless only" principle. |
| Mig-7 | App update | Keep the GitHub Releases flow (`version.json` + APK) for in-app updates. |
| Mig-8 | Tooling | Use **Bun** for project creation & package management; create projects via generators, never hand-write `package.json`. |
| Mig-9 | Docs language | All documentation (AGENTS.md + context/) is in **English**. Only the app UI is in Bahasa Indonesia. |

---

## TBC to Confirm

See `context/progress/to-be-confirmed.md`. **All verifikasi/denda TBCs (1–5) locked on 2026-08-06** (auto-fine on reject; review = Admin/PJ only; public photo URLs; Verifikasi tab always visible; history visible to all members). M3 verifikasi feature is now unblocked.
