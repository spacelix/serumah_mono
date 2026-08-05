# Memory — Serumah M0.2 (Monorepo scaffold complete)

Last updated: 2026-08-05

## What was built

- **`packages/db` → `@serumah/db`** now builds to **`dist/`** (`tsconfig.build.json`, exports `.` → `./dist/client.js`, `./prisma` → `./dist/prisma.module.js`). Added `PrismaService` (extends PrismaClient, pg adapter) + `@Global() PrismaModule`. `@nestjs/common` added as dep. `build`/`typecheck` scripts added (`prebuild` runs `prisma generate`).
- **`apps/api` → `@serumah/api`** (NestJS 11, scaffolded via `@nestjs/cli`): `ConfigModule`, `ScheduleModule`, global `PrismaModule`, global `JwtModule`, `PassportModule`, global `JwtAuthGuard` (uses `@Public()` to bypass), `JwtStrategy` (passport-jwt), decorators (`@CurrentUser`, `@Roles`, `@Public`), `HttpExceptionFilter` (Indonesian messages, no stack traces). `StorageModule` (MinIO: auto-creates `serumah` bucket on init, non-fatal if MinIO down). `main.ts`: global prefix `api`, `ValidationPipe({whitelist, transform})`, CORS. Health endpoint `GET /api`. `.env.example` → `.env` (dev).
- **`apps/mobile` → `@serumah/mobile`** (Expo 57 default template, `src/` layout, expo-router). Added `@tanstack/react-query`, `zustand`, `axios`; `eslint-config-expo ~57.0.1` + `eslint.config.js`. App name/slug `Serumah`/`serumah`. Added `expo-env.d.ts` (CSS-module types) and a lint-disable on the template's `use-color-scheme.web.ts` hydration hook.
- **AGENTS.md**: added mandatory **Verification & Per-Item Commits** rule (verify build/lint/typecheck/test before done; commit per item; docs updated in the same commit).

## Decisions made

- Repo now lives at **`/home/xavier/House`** (WSL folder, move done). Branch `development`.
- `@serumah/db` ships compiled JS — **run `turbo build` (or `bun run build` in packages/db) before starting `apps/api`** and after any schema change. Generated client at `packages/db/generated/client` (gitignored, regenerated); imported in `packages/db` sources as `../generated/client/index.js` (NodeNext needs the explicit extension; the generated package's `exports` has no `types` condition for `.`).
- Verification-first + atomic per-item commits is now a locked agent rule (user request).
- `.env` lives per-package. `apps/api/.env` from `.env.example`.

## Problems solved

- **Generated client import**: `@prisma/client` dir import fails NodeNext (package.json `exports` lacks `types` for `.`) → import `../generated/client/index.js` explicitly. From `src/` the path is `../generated` (not `./generated`).
- **JwtModule.registerAsync** `inject` must be the `ConfigService` class token, not `ConfigModule`.
- **packages/db lint** had no eslint installed → changed to `tsc --noEmit`.
- **eslint-config-expo version**: `~13.0.0` doesn't exist; SDK 57 needs `~57.0.1`.
- **Mobile typecheck**: needed `expo-env.d.ts`; template demo hook tripped `react-hooks/set-state-in-effect` → eslint-disable with rationale (hook replaced in M4).
- **Runtime boot**: `nest start` failed on raw-TS `@serumah/db` until it shipped compiled `dist/`.

## Current state

- **M0 complete.** `turbo run build lint typecheck` → 7/7 green. API unit + e2e pass; boots at `http://localhost:3000/api` (health ok, MinIO bucket `serumah` created). Mobile typecheck + lint green; `expo config` validates (name Serumah).
- Postgres on `localhost:5432` (dev) + MinIO `localhost:9000` (minioadmin/minioadmin dev) running via docker-compose.
- Changes are being committed **per item** this session (db → api → mobile → docs+memory).

## Next session starts with

1. Finish/verify the per-item commits (if not yet pushed).
2. **M1 — Release & In-App Update (FIRST, locked)**: `.github/workflows/release.yml` (tag `v*`, expo prebuild, keystore secrets, gradle assembleRelease, `version.json` + `apkUrl` manifest) + in-app update in `apps/mobile` (`lib/update.ts` + `UpdateDialog`). Ask user before starting (phase gating).

## Open questions

- `packages/db` seed is **not idempotent** (ruangan `create` with deterministic IDs fails on re-run) — fix in M2 dev-data seeding.
- Keystore secrets not set in GitHub yet (M1).
- Root `package.json` name is `serumah` (was an open question; fine as-is).
