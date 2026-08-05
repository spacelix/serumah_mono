# Progress Tracker

Update after every completed feature. Any agent reading this should immediately know: what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** M0 — Documentation & Foundation (in progress)
**Last completed:** M0.1 — Per-feature context split (docs-first). `AGENTS.md` rewritten (RN+NestJS stack), new `context/` structure (core/, architecture/, 14 features/, progress/), `architecture/data-model.md` (Prisma schema source of truth).
**Next:** M0.2 — Monorepo scaffold (root workspaces, docker-compose, packages/db Prisma, apps/api NestJS, apps/mobile Expo).

> Migration from **Flutter + Supabase + Riverpod** → **React Native (Expo) + NestJS + PostgreSQL/Prisma + MinIO (React Query + Zustand)**. Locked decisions: monorepo in `/mnt/d/Source/House`, full re-seed from scratch (no supabase data migration, project not live), in-app update stays via GitHub Releases. The old Flutter repo `/mnt/d/Source/serumah` is kept as reference (not the code base).

---

## Progress

### Phase M0 — Documentation & Foundation

- [x] M0.1 Per-feature context split (AGENTS.md + context/core + data-model + 14 features/ + progress/)
- [ ] M0.2 Monorepo scaffold (root, docker-compose, packages/db, apps/api NestJS, apps/mobile Expo)

### Phase M1 — Backend Core (NestJS)

- [ ] Auth (register/login/JWT)
- [ ] Anggota/Profile
- [ ] Rumah (create/join/invite)
- [ ] Storage service (MinIO)
- [ ] Seed dev data

### Phase M2 — Backend Features

- [ ] Ruangan & Jenis Piket (CRUD + reorder)
- [ ] Schedule (round-robin, weekend, freeze, generate)
- [ ] Piket (submissions + ruangan_proof)
- [ ] Verifikasi & Denda (per-submission approval, QRIS payment)
- [ ] Iuran & Listrik (auto-split, total proof, pelunasan, adjust)
- [ ] Swap & Galon
- [ ] Cron (auto-fine, weekend freeze)
- [ ] Update manifest

### Phase M3 — Mobile: Auth & Onboarding

- [ ] Expo theme + router + authStore guard
- [ ] Splash, Login, Register
- [ ] Onboarding (profile, create rumah, join rumah)

### Phase M4 — Mobile: Main Tabs

- [ ] Beranda (weekend, galon, billing, schedule)
- [ ] Piket (per-room flow)
- [ ] Tagihan (Denda | Iuran | Listrik + month picker)
- [ ] Swap
- [ ] Profile & Rumah Management

### Phase M5 — Release

- [ ] In-app update (GitHub Releases)
- [ ] GitHub Actions build APK + release

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
