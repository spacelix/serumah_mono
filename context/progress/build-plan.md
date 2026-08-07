# Build Plan — Migration to React Native + NestJS

Phased plan for implementing the Serumah monorepo (RN + NestJS + Postgres/Prisma). Same principle as the Flutter era: **UI-first** — design with mock data, review, then wire the API. Docs-first: update the feature context before code.

Each phase must be fully complete before the next starts (Phase Gating). When a phase is complete → stop & ask the user: *"Phase X done. Proceed to Phase Y?"*

**Phase ordering (locked):** the **Release pipeline comes FIRST** (M1), right after the scaffold. This is a user decision — it lets the in-app update feature be tested and monitored continuously while the rest of the app is built. Every phase after M1 ships an APK that updates in-app through the same mechanism.

---

## Phase M0 — Documentation & Foundation (ACTIVE)

### M0.1 Per-feature context split — DONE
- `AGENTS.md` rewritten (RN+NestJS stack, routing, anti-hallucination).
- `context/core/*` (AGENTS-ROUTING, ui-tokens, ui-rules, code-standards).
- `context/architecture/data-model.md` (Prisma schema source of truth).
- 14 `context/features/*/context.md`.
- `context/progress/*`.

### M0.2 Monorepo scaffold
- Root: `package.json` (npm/bun workspaces + turborepo), `tsconfig.base.json`, `.gitignore`.
- `docker-compose.yml` (Postgres 16 + MinIO) + `.env.example`.
- `packages/db`: Prisma schema (from `architecture/data-model.md`), initial migration, seed.
- `apps/api`: NestJS scaffold (config, prisma service, jwt guard, exception filter, storage module).
- `apps/mobile`: Expo scaffold (Expo Router, theme from ui-tokens, api client, React Query + Zustand).

---

## Phase M1 — Release & In-App Update (FIRST — user decision)

> Why first: the in-app update feature is built and tested **now** so it can be monitored through the whole development cycle. From here on, every release (even partial builds) exercises the same update pipeline.

- **In-app update**: version check at launch (release mode only), Update dialog, optional vs force update (`minVersionCode`), APK download + install. (`features/update`)
- **GitHub Actions**: build Android APK + generate `version.json` + publish GitHub Release on tag `v*`. Trigger = tag `v*` pushed (locked decision, option 1). Signed APK via keystore secrets.
- **Manifest**: `version.json` fields (versionCode, versionName, minVersionCode, apkUrl, notes) served from the release. Repo: `spacelix/serumah_mono`.
- **Test loop**: cut a test release → install older APK → ship new APK → verify in-app update prompt appears → update → confirm new version. Repeat on each phase.
- **Native build verification** (EAS/GitHub — not WSL).

Dependency: needs a buildable `apps/mobile` (M0.2 scaffold) — even before features exist, a skeleton APK with the update check can be distributed.

---

## Phase M2 — Backend Core (NestJS)

- **Auth**: register/login/JWT, `/auth/*`. (`features/auth`)
- **Anggota/Profile**: `/anggota/me`, profile update, avatar upload. (`features/profile`, `features/onboarding`)
- **Rumah**: create/join/invite code. (`features/onboarding`, `features/rumah`)
- **Storage service**: MinIO upload → `photos/`, `profiles/` paths.
- **Seed**: dev data (rumah, anggota, ruangan, jenis_piket, jadwal, status, denda, iuran, etc.).

---

## Phase M3 — Backend Features

- **Ruangan & Jenis Piket**: CRUD + reorder. (`features/rumah`)
- **Schedule**: weekday round-robin, dynamic weekend, freeze, generate. (`features/schedule`)
- **Piket**: submissions + ruangan_proof. (`features/piket`)
- **Verifikasi & Denda**: per-submission approval, flat fine, QRIS payment. (`features/verifikasi`, `features/denda`)
- **Iuran & Listrik**: ensure-bulan, auto-split, total proof, pelunasan, listrik adjustment. (`features/iuran`, `features/listrik`)
- **Swap & Galon**. (`features/swap`, `features/galon`)
- **Cron**: auto-fine (22:00), weekend freeze (Fri 20:00). (`features/schedule`)

---

## Phase M4 — Mobile: Auth & Onboarding

- Expo theme (tokens), Expo Router (auth stack vs tabs), authStore Zustand + guard.
- Splash, Login, Register. (`features/auth`)
- Onboarding: profile, create rumah, join rumah. (`features/onboarding`)

---

## Phase M5 — Mobile: Main Tabs

- **Beranda**: weekend card, galon widget, billing summary, schedule list. (`features/dashboard`)
- **Piket**: per-room before→checklist→after, submit. (`features/piket`)
- **Tagihan**: segment Denda | Iuran | Listrik, month picker, QRIS, proof upload. (`features/denda`, `features/iuran`, `features/listrik`)
- **Swap**. (`features/swap`)
- **Profile & Rumah Management** (incl. room management). (`features/profile`, `features/rumah`)

---

## Phase M6 — Final Release & E2E

- Full end-to-end testing across all features.
- Final release through the (already working) update pipeline.
- Production hardening (logs, monitoring, backup).

---

## Feature Count (per area)

| Area | Features |
|---|---|
| Docs | 1 (per-feature context split) |
| Backend | 13 (auth, profile, rumah, ruangan, schedule, piket, verifikasi, denda, iuran, listrik, swap, galon, update) |
| Mobile | 14 screen-groups (auth, onboarding, dashboard, piket, tagihan×3, swap, profile, rumah, update) |

Every feature has `context/features/<feature>/context.md` — read before coding (see `core/AGENTS-ROUTING.md`).

## Build Order Summary

1. **M0** docs + scaffold → 2. **M1** release/update pipeline (FIRST) → 3. **M2** backend core → 4. **M3** backend features → 5. **M4** mobile auth/onboarding → 6. **M5** mobile tabs → 7. **M6** final E2E release.

From M1 onward, every phase ships an APK through the same update pipeline so in-app updates are continuously testable.
