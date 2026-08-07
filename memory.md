# Memory — Serumah: log viewer, timezone fix, weekend generate, galon widget, bottom nav (2026-08-08)

Last updated: 2026-08-08 (session end)

## What was built

**Log Viewer & Stats (from prior session, committed):** global `LoggerInterceptor` → Redis `log:buffer` → BullMQ 5-min flush → `log_entries` table; `/api/admin` HTML page (stats + logs), fully public. Redis read-cache (`CacheService`) on dashboard/profile. Prettier root config (`singleQuote`, `.prettierignore`). (Commits `5ac23ee`..`00ba4ba`, `77ba8f8` review fixes.)

**This session (commits `70e5101`, `571f551`, `6a666bf`):**
- **Timezone fix (CRITICAL, schedule/dashboard):** Prisma stores `@db.Date` as **UTC** date strings. All date helpers in `schedule.service.ts` + `dashboard.service.ts` now build UTC-midnight Dates (`Date.UTC(...)`), resolve "today" by shifting +7h (WIB offset) before reading UTC components, and use `getUTCDay()/getUTC*`. `assertNotFrozen` (Fri 20:00 WIB) + fine `deadline` (20:00 WIB) are explicit UTC+7. This fixed the bug where the PJ banner + Generate button showed though the schedule existed (dates were shifted a day on WIB/UTC-mismatched servers).
- **Weekend generate on Di kos (locked):** `setWeekendStatus` with `di_kos` now immediately calls `ensureWeekend` for that weekend day — UI shows who piket right away, no need to wait for freeze.
- **Weekday exemption (locked):** members holding a weekend Jadwal that week are excluded from weekday round-robin that same week (`ensureWeekday` filters via `weekendAssigneeIds`; `setWeekendStatus`/`generateRestOfWeek` regenerate affected weekday rows; `generateRestOfWeek` does weekend first then weekday).
- **Safe area (mobile):** `welcome.tsx` root `View` → `SafeAreaView edges={['bottom']}`; splash `version` bottom uses `max(insets.bottom, 12)+26` — fixes content hidden behind Android 3-button nav.
- **Beranda dialogs:** `Alert.alert` → `ConfirmDialog` (single mode) for "Status dibekukan" (WeekendCard) and galon "Gagal". Removed duplicate frozen handling in `WeekendDayRow`.
- **Galon widget redesign (per Serumah.html):** conditional button — `isMine` → "Sudah Beli"; else bell/nudge icon (36×36) + hint "Galon habis? colek dia biar segera beli" → after tap "Notif sudah dikirim ke X" (local state, no backend). Green chip "Tercatat. Giliran maju ke X · notif terkirim." (bg `pineSoft`) — **full width** (was `alignSelf:'flex-start'`, fixed to `width:'100%'`).
- **Bottom nav gap fix (UNCOMMITTED, `_layout.tsx`):** `paddingBottom: insets.bottom + 22` → `+ 8`. insets.bottom already = Android nav bar height (3-button ≈48dp), the +22 doubled the gap. Change made but **not yet committed/verified**.

## Decisions made

- **Timezone:** all schedule/dashboard calendar math runs in WIB (UTC+7) wall-clock, stored/computed as UTC-midnight dates. Behavior identical whether server runs UTC (Docker) or WIB (dev). Documented in `context/features/schedule/context.md` constraints.
- **Weekend rules (locked 2026-08-08):** (1) choosing `di_kos` generates that weekend day's Jadwal immediately; (2) weekend piket assignees are exempt from weekday piket the same week. Both documented in schedule context.
- **Galon nudge is UI-only** (local state, no backend call — FCM not wired). Documented in galon context.
- `iuran`/`listrik` services still use local-midnight `new Date(y,m,1)` for `bulan` (`@db.Date`) — **same timezone bug class, NOT yet fixed** (out of scope this session).

## Problems solved

- **Timezone off-by-one:** local-midnight JS Dates vs `@db.Date` (Prisma stores UTC). Verified via repro: `new Date(2026,8,3)` in WIB = `2026-08-02T17:00Z` → stored `2026-08-02`. Fix: UTC-midnight helpers + WIB offset.
- **Weekend schedule not appearing after di_kos:** `setWeekendStatus` only upserted status; now generates the Jadwal too.
- **Galon "Sudah Beli" shown for others' turn:** now conditional on `isMine`.
- **Green chip not showing:** was tied to transient local `justBought`; and `alignSelf:'flex-start'` made it not full width.

## Current state

- Working tree: only `apps/mobile/src/app/(tabs)/_layout.tsx` (bottom nav gap fix) + `memory.md` **uncommitted**.
- Branch `development` ahead of `origin/development` by **3 commits** (`70e5101`, `571f551`, `6a666bf`) — **push pending** (from Windows `D:\Source\House`, WSL SSH rejected).
- `origin/development` was at `07a8c53` (redis compose). Tag `v1.6.9` exists.
- All committed items verified green by user earlier (api build/test + mobile tsc + prettier). The uncommitted `_layout.tsx` change needs `bunx tsc --noEmit` + prettier check.
- Redis service added to `docker-compose.yml` (commit `07a8c53`); server `.env` needs `REDIS_URL=redis://redis:6379`.

## Next session starts with

1. **Commit the bottom-nav gap fix** (`_layout.tsx` `insets.bottom + 8`) after user verifies (`bunx tsc --noEmit` + prettier).
2. **Push** `development` (3 commits ahead) from Windows; if user wants, also update server deploy with new Redis + re-deploy.
3. Decide whether to apply the **same timezone fix to `iuran`/`listrik`** (`firstOfMonth`/`monthFromString` still local-midnight — same `@db.Date` bug).
4. Continue **Phase M5**: Piket (per-room flow), Tagihan, Swap tabs (Beranda done).

## Open questions

- `iuran`/`listrik` timezone fix — apply or defer? (same bug class as the schedule fix)
- Galon nudge is local-only; real FCM notification deferred (not required v1).
- Phase M6 (E2E/final release) not approved — ask before starting.
