# Progress Tracker

Update after every completed feature. Any agent reading this should immediately know: what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** M1 — Release & In-App Update (COMPLETE — test loop pending for locks)
**Last completed:** M1 — Release pipeline verified live: `v1.0.1` released via GitHub Actions (tag `v*` → `expo prebuild` → `gradlew assembleRelease` signed → `serumah-app.apk` + `version.json` published). Manifest confirmed (`versionCode 2`, apkUrl, notes). In-app update check + `UpdateDialog` implemented (release-mode, optional vs force, APK download + install). Cleanup done: `key.properties`, `.env`, `*.jks`, `/android` all gitignored; nothing secret tracked.

**Next:** M1 test loop — install `v1.0.1` APK on emulator/device, bump to `v1.0.2`, cut tag, verify the in-app update prompt appears and installs. Then Phase M2 (Backend Core).

> **Phase order (user decision):** Release/update pipeline is **M1 — FIRST**, right after scaffold, so in-app updates can be tested & monitored throughout development. After M1, every phase ships an APK through the same update pipeline.

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

- [ ] Auth (register/login/JWT)
- [ ] Anggota/Profile
- [ ] Rumah (create/join/invite)
- [ ] Storage service (MinIO)
- [ ] Seed dev data

### Phase M3 — Backend Features

- [ ] Ruangan & Jenis Piket (CRUD + reorder)
- [ ] Schedule (round-robin, weekend, freeze, generate)
- [ ] Piket (submissions + ruangan_proof)
- [ ] Verifikasi & Denda (per-submission approval, QRIS payment)
- [ ] Iuran & Listrik (auto-split, total proof, pelunasan, adjust)
- [ ] Swap & Galon
- [ ] Cron (auto-fine, weekend freeze)
- [ ] Update manifest

### Phase M4 — Mobile: Auth & Onboarding

- [ ] Expo theme + router + authStore guard
- [ ] Splash, Login, Register
- [ ] Onboarding (profile, create rumah, join rumah)

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

See `context/progress/to-be-confirmed.md`. Open item blocking implementation: **TBC-2 (who may review piket)** — must ask the user before working on the verifikasi feature.
