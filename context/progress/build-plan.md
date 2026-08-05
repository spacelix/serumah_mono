# Build Plan — Migration to React Native + NestJS

Phased plan for implementing the Serumah monorepo (RN + NestJS + Postgres/Prisma). Same principle as the Flutter era: **UI-first** — design with mock data, review, then wire the API. Docs-first: update the feature context before code.

Each phase must be fully complete before the next starts (Phase Gating). When a phase is complete → stop & ask the user: *"Phase X done. Proceed to Phase Y?"*

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

## Phase M1 — Backend Core (NestJS)

- **Auth**: register/login/JWT, `/auth/*`. (`features/auth`)
- **Anggota/Profile**: `/anggota/me`, profile update, avatar upload. (`features/profile`, `features/onboarding`)
- **Rumah**: create/join/invite code. (`features/onboarding`, `features/rumah`)
- **Storage service**: MinIO upload → `photos/`, `profiles/` paths.
- **Seed**: dev data (rumah, anggota, ruangan, jenis_piket, jadwal, status, denda, iuran, etc.).

---

## Phase M2 — Backend Features

- **Ruangan & Jenis Piket**: CRUD + reorder. (`features/rumah`)
- **Schedule**: weekday round-robin, dynamic weekend, freeze, generate. (`features/schedule`)
- **Piket**: submissions + ruangan_proof. (`features/piket`)
- **Verifikasi & Denda**: per-submission approval, flat fine, QRIS payment. (`features/verifikasi`, `features/denda`)
- **Iuran & Listrik**: ensure-bulan, auto-split, total proof, pelunasan, listrik adjustment. (`features/iuran`, `features/listrik`)
- **Swap & Galon**. (`features/swap`, `features/galon`)
- **Cron**: auto-fine (22:00), weekend freeze (Fri 20:00). (`features/schedule`)
- **Update manifest**: serve `version.json` info + release wiring. (`features/update`)

---

## Phase M3 — Mobile: Auth & Onboarding

- Expo theme (tokens), Expo Router (auth stack vs tabs), authStore Zustand + guard.
- Splash, Login, Register. (`features/auth`)
- Onboarding: profile, create rumah, join rumah. (`features/onboarding`)

---

## Phase M4 — Mobile: Main Tabs

- **Beranda**: weekend card, galon widget, billing summary, schedule list. (`features/dashboard`)
- **Piket**: per-room before→checklist→after, submit. (`features/piket`)
- **Tagihan**: segment Denda | Iuran | Listrik, month picker, QRIS, proof upload. (`features/denda`, `features/iuran`, `features/listrik`)
- **Swap**. (`features/swap`)
- **Profile & Rumah Management** (incl. room management). (`features/profile`, `features/rumah`)

---

## Phase M5 — Release

- In-app update via GitHub Releases (`version.json` + APK). (`features/update`)
- GitHub Actions: build Android APK + release on tag `v*`.
- Native build verification (EAS/GitHub) + end-to-end testing.

---

## Feature Count (per area)

| Area | Features |
|---|---|
| Docs | 1 (per-feature context split) |
| Backend | 13 (auth, profile, rumah, ruangan, schedule, piket, verifikasi, denda, iuran, listrik, swap, galon, update) |
| Mobile | 14 screen-groups (auth, onboarding, dashboard, piket, tagihan×3, swap, profile, rumah, update) |

Every feature has `context/features/<feature>/context.md` — read before coding (see `core/AGENTS-ROUTING.md`).
