# Memory — Serumah: Beranda redesign, auth dialog, bottom nav, docker deploy (2026-08-07)

Last updated: 2026-08-07 (updated same day with release bump)

## What was built

- **Version bump to 1.6.9 / versionCode 8** (`apps/mobile/app.json`) — `e409121 build(mobile): bump app to 1.6.9 and versionCode 8`. Version only lives in `app.json`; `lib/update.ts` reads installed/manifest versionCode, no hardcode.
- **Beranda redesigned** to match `Serumah.html` (all in `apps/mobile/src/app/(tabs)/index.tsx` + `features/dashboard/api/dashboard.ts` + `lib/format.ts`):
  - Weekend card: custom pine bg, deadline badge "Jum 20:00", active "Di kos" = paper pill w/ ink text, horizontal-scroll "anggota lain", brick warning strip `rgba(179,63,63,0.22)`/`colors.brickSoft`.
  - Galon card: custom droplet SVG (`M7.4 13h9.2`), kicker mono, "Giliran: Nama (lo)" via new `isMine` from `GalonService.current()`.
  - Billing card: kicker "Tagihan bulan ini", mono amount, "Lihat detail" → `/tagihan`. API `getBilling` returns `{total,lunas,bulan}`.
  - Jadwal card: header + week range (e.g. "27 Jul – 2 Agu"), `Libur`-dashed cards for off days, chips weekday abbrev.
- **Login/Register** (`(auth)/login.tsx`, `(auth)/register.tsx`): native `Alert.alert` → custom `ConfirmDialog` with new `single` prop (single-action info dialog). Password-mismatch shown as dialog too.
- **Custom bottom nav** (`(tabs)/_layout.tsx` + new `components/ui/tab-icon.tsx`): absolute-overlay `LinearGradient` (solid paper → transparent, no gap, content flows behind), active = ink pill, inactive transparent. Icons rendered from **exact Serumah.html SVG paths** via `react-native-svg` (`TabIcon`) — NOT lucide (design glyphs don't map to lucide).
- **Kelola Rumah → schedule refresh**: `manage.tsx` tracks `addedJenis`; on back after adding a jenis piket, confirm dialog calls new admin endpoint `POST /schedule/refresh-future-rooms` which rewrites only the `ruangan[]` snapshot of **future** Jadwal rows (member assignment preserved, past days untouched).
- **Docker deploy** (all committed):
  - `apps/api/Dockerfile`: multi-stage `oven/bun:1-alpine` build → `node:22-alpine` runtime; `bun install --frozen-lockfile --filter @serumah/api`; apk adds `openssl` (+`libc6-compat` in runner).
  - `docker-compose.yml`: backend only, traefik host `api-serumah.spacelix.qzz.io`, port 3000, no postgres/minio (uses existing DB+MinIO). Build context = root; dockerfile `apps/api/Dockerfile`.
  - `.dockerignore`: excludes mobile source (`apps/mobile/*`) but **keeps** `apps/mobile/package.json`.

## Decisions made

- Backend mobile app is **RN** (not web) → docker only has a backend service; frontend/mobile excluded from deploy.
- Bottom nav is an **overlay** (gradient fade, content scrolls behind) rather than a separate bar — per design, no gap between content and tabs.
- Icons must come from the **design SVG paths** not lucide — lucide glyphs differ from the design.
- Schedule refresh is triggered **on leaving** Kelola Rumah (confirm dialog), not at add-time; treats only future days.
- **Major version (6→7) stays 6.x for now**: patch/minor (1.6.x + versionCode up) is enough for new features/redesigns. Only bump major on breaking change (schema overhaul, endpoint removal, big rewrite). versionCode is what the in-app update actually compares.

## Problems solved

- Docker build failures in sequence:
  1. `oven/bun:1` default is Debian (no `apk`) → use `oven/bun:1-alpine`.
  2. `@serumah/typescript-config` workspace missing in deps stage → COPY `packages/typescript-config`.
  3. `bun install --frozen-lockfile` failed ("lockfile had changes"): `bun.lock` spans all workspaces incl. mobile, but mobile pkg wasn't in context → add `apps/mobile/package.json` to context.
- Dockerignore can't re-include a file whose parent dir is excluded → use `apps/mobile/*` (exclude contents) + `!apps/mobile/package.json` (re-include file).
- `BottomTabBarProps` type import path is `expo-router/build/react-navigation/bottom-tabs/types` (not `@react-navigation/bottom-tabs`).
- `bun install --filter <pkg>` temporarily prunes other workspaces' node_modules → run full `bun install` to restore workspace state.

## Current state

- Working tree **clean** at HEAD `e409121`. Committed today: `8b514c2` (docker files), `5f4d564` (alpine base), `998215a` (ts-config workspace), `adda829` (workspace set frozen lockfile), `a5da5c3` (mobile pkg.json dockerignore), `b56f7bd` (beranda + schedule refresh API), `a7de322` (auth dialog), `3c4cd69` (custom bottom nav), `44739b0` (rumah schedule refresh UI), `fab12a2` (progress tracker), `e409121` (version bump 1.6.9/versionCode 8).
- **Push NOT yet — WSL SSH key rejected.** Repo at `/mnt/d` (WSL→Windows D:). Push normally done from **Windows** (`D:\Source\House`): `git push origin development`. Tag `v1.6.9` (annotated) still to create → triggers `release.yml`. `origin/development` ahead by 2 (`fab12a2`, `e409121`).
- Backend deploy: Docker **build succeeded** on server (`43.129.40.34`) via traefik. Need `apps/api/.env` on server pointed at existing DB/MinIO (repo `.env` uses `localhost`) and `traefik-public` network to exist.
- `bunx tsc --noEmit` mobile clean. Docker build verified; live runtime still to verify.
- Phase: **M5** (Beranda done — weekend/galon/billing/jadwal). Piket, Tagihan, Swap, Profile still in-flight; **Phase M6 deferred** (awaiting approval).

## Next session starts with

1. **Push `development` + create annotated tag `v1.6.9`** — either from Windows (`D:\Source\House`): `git push origin development` then `git tag -a v1.6.9 -m "release: v1.6.9 (versionCode 8) — beranda redesign, bottom nav, auth dialog, schedule refresh" && git push origin v1.6.9`, or fix WSL key. Tag triggers CI APK. Confirm backend runs on server (`apps/api/.env` prod DB/MinIO) — curl health + real login.
2. Continue **Phase M5**: Piket (per-room flow), Tagihan (Denda|Iuran|Listrik + month picker), Swap tabs.
3. `progress-tracker.md` Phase M5 checklist — Beranda item can be marked done.

## Open questions

- Phase pacing: some Beranda cards were rebuilt from design; confirm the rest of Beranda matches.
- Phase M6 E2E/release pipeline still not approved — ask before starting.
- Note: prior-session "profile revision (uncommitted)" notes in progress-tracker were resolved and committed last session; profile revision itself was NOT rebuilt this session.
