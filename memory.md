# Memory — Serumah M5 complete; switching to Windows/Expo Go

Last updated: 2026-08-06

## What was built

- **M1 — Release & update pipeline**: GitHub Actions `release.yml` (tag `v*` → expo prebuild, signed keystore, gradle assembleRelease, `version.json` + `apkUrl` manifest) + in-app update check + `UpdateDialog` (release mode only).
- **M2 — Backend core (NestJS) done**: Auth (register/login/JWT), Anggota/Profile, Rumah (create/join/invite), MinIO storage + avatar, idempotent dev seed, JWT DB-lookup + RolesGuard.
- **M4 — Mobile auth done**: Expo theme tokens, Zustand `useAuthStore` (SecureStore persistence, stages `checking|anonymous|no-profile|no-rumah|ready`), Splash/Welcome/Login/Register, Onboarding (profile → create/join rumah). All committed.
- **M5 — Main Tabs COMPLETE** (all committed, monorepo `bunx turbo run build lint typecheck test` green 8/8 at the time):
  - M5.1 Beranda (`GET /dashboard` → weekend/galon/billing/scheduleWeek/memberName) + `features/dashboard/api` + `lib/format.ts`.
  - M5.2 Piket — per-room before→checklist→after flow, `features/piket/api/piket.ts`, `stores/piket-draft-store.ts`.
  - M5.3 Tagihan — 3 segments (Denda|Iuran|Listrik) + shared `MonthPicker`, `components/ui/stamp.tsx`, shared `features/tagihan/api/upload.ts`.
  - M5.4 Swap — incoming/mine lists + 2-step form; `features/swap/api/swap.ts` + `members.ts`.
  - M5.5 Profile & Rumah Management — `app/profile.tsx`, new backend `apps/api/src/modules/rumah/{rumah.controller,rumah.service,rumah.dto}.ts` (`GET/PATCH /rumah/me`, `POST /rumah/reset-invite`, `PUT /rumah/qris`, `DELETE /rumah/anggota/:id`, admin via `@Roles('admin')`), `app/rumah/manage.tsx` with inline Kelola Ruangan (rooms + jenis piket CRUD/reorder; `PUT /ruangan/reorder` takes `{urutan: string[]}`).

## Decisions made

- **Android native build is ABANDONED in WSL** — the `/mnt/c/Android` SDK is Windows-hosted (`.exe` build-tools, `windows-x86_64` NDK prebuilt). Linux Gradle can't execute `.exe`, and Windows `gradlew.bat` fails on the WSL 9P filesystem (`\\wsl.localhost` → Gradle FileHasher "Incorrect function"). **Decision: build/run on Windows directly.**
- **App runs via Expo Go** (`bun expo start`), not `expo run:android`. Dev server: `http://localhost:8081`.
- Permissions (camera/gallery) stay lazy-requested on first use via `ImagePicker.launchCameraAsync`/`launchImageLibraryAsync` — Android best practice; user declined an early boot-time permission prompt.
- Local fonts bundled under `apps/mobile/assets/fonts/` (12 weights, Inter/Space Grotesk/JetBrains Mono) — `@expo-google-fonts/*` removed (Metro bun-symlink issue). Use `fontFamilies.{display,body,mono}[w]`.
- Stamp (`components/ui/stamp.tsx`) only for status. All UI text Bahasa Indonesia. Money = JetBrains Mono, `id_ID` format.

## Problems solved

- **NDK 27 missing/corrupt**: Expo/SDK 57 defaults `ndk: 27.1.12297006`; dir was empty. User manually installed NDK 27 r27b → `/mnt/c/Android/ndk/27.1.12297006/source.properties` now present. (Not needed anymore since Expo Go — but fixed.)
- **`local.properties` missing** → Android build "SDK location not found". Added `apps/mobile/android/local.properties` with `sdk.dir=C:\Android`. (dir is gitignored/regenerated.)
- **Build-tools 36.0.0 "corrupted" (missing aapt)**: root cause = only Windows `.exe` binaries exist; not fixable under WSL Linux Gradle → abandoned native build.
- **Windows `gradlew.bat` via `cmd.exe`**: UNC path unsupported → use `pushd \\\\wsl.localhost\\rocky\\...` from `C:\`; still fails on 9P filesystem hashing.

## Current state

- **M0–M5 all committed & green.** Phase tracker header: "Phase: M5 — Mobile: Main Tabs", Next: Phase M6 (to be confirmed).
- `apps/mobile/android/` is **gitignored** (generated). Uncommitted/unrelated: `apps/mobile/package.json` + `bun.lock` (added `expo-dev-client@~57.0.10`) — NOT ours, left unstaged.
- Expo Go dev server can be started with: `cd apps/mobile && bun expo start` (uses `.env` `EXPO_PUBLIC_API_URL=http://localhost:3000`).
- Postgres `localhost:5432` + MinIO `localhost:9000` via docker-compose. `@serumah/db` ships compiled JS — run `turbo build`/`bun run build` in `packages/db` before `apps/api` and after schema changes.

## Next session starts with

1. **Run the app on Windows (user's choice).** Prepare Windows environment (steps below in conversation / docs). Likely: run Expo Go on a Windows-hosted phone via LAN, or build the APK on Windows using the Windows SDK + Gradle.
2. If building APK on Windows: clone/copy repo to a real `C:\` path (not the 9P mount), use the Windows Android SDK (`C:\Android`), and run `gradlew.bat assembleRelease` (or `expo run:android`) there.
3. Phase gating: confirm with user before starting Phase M6.

## Open questions

- **Phase M6 scope** — not yet defined/approved (stop & ask before starting).
- **Keystore signing secrets** for release pipeline — confirm GitHub secrets `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` are set.
- Whether the `expo-dev-client` dependency (uncommitted) is intentional.
