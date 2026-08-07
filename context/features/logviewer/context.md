# Feature Context — Log Viewer & Stats

## 1. Goal & Scope
A self-hosted log viewer + stats page served by the existing **NestJS backend** (`apps/api`) — no separate project/service, no mobile app involvement. Purpose: see request logs and aggregate statistics (traffic, error rate, latency, top endpoints) to monitor the running API on the VPS.

Because NestJS logs today only go to stdout (lost on container restart), the feature introduces a **request logging interceptor** that buffers each request into **Redis**, a **BullMQ repeatable job** flushes the buffer into a new Postgres table (`LogEntry`) every 5 minutes, plus a lightweight HTML admin page rendered by the API itself that reads those rows. The same Redis instance is also used as a **read-cache** for referential Beranda/Profile endpoints (data that changes rarely, is read often).

**Locked decisions (2026-08-07):**
- **Pipeline:** `LoggerInterceptor` → `RPUSH log:buffer` (Redis list, microseconds, never blocks) → **BullMQ repeatable job every 5 min** drains buffer atomically (`LRANGE` + `DEL`) → `prisma.logEntry.createMany` bulk insert. No per-request queueing.
- **Sink table:** Postgres `LogEntry`. Survives restarts, queried for stats.
- **Redis:** shared instance for (a) log buffer and (b) referential Beranda/Profile read-cache (via `ioredis`, brought in by BullMQ). TTL ~60s, invalidated on related mutations. Keyed `cache:{rumahId|anggotaId}:{resource}`.
- **Access surface:** self-hosted lightweight HTML page at `GET /admin`, backed by REST endpoints.
- **Auth:** **fully public — no login required** (`@Public()`, bypasses the global JWT/Roles guards). Risk accepted by the user: anyone who knows the URL can view log/stats data. This is a deliberate user decision, not an oversight.
- **Location:** inside the existing `apps/api` package (one app, one container, `/admin` routes).

## 2. Data Model
New model (to be added to `context/architecture/data-model.md` FIRST, then `packages/db/prisma/schema.prisma`):

- `LogEntry`: `id` (BigInt, autoincrement), `timestamp`, `method`, `path`, `statusCode`, `durationMs`, `userId?`, `ip?`, `isError`, `errorMessage?` (snippet captured only when `statusCode >= 400`).
- No `rumah_id` — this is an infra/audit table, **not** a rumah-scoped table. The "every query filters `rumah_id`" invariant explicitly does **not** apply here (it is an exception, documented).
- Indexed on `timestamp` and `isError`.

Redis keys:
- `log:buffer` — Redis list of JSON log entries awaiting flush.
- `cache:{scope}:{resource}` — read-cache for referential Beranda/Profile data.

## 3. API Contract (NestJS)
Module: `admin`. All endpoints `@Public()`.

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/admin` | — | `text/html` | Self-hosted viewer page (inline CSS/JS, no framework). |
| GET | `/admin/stats` | — | `{ total, errors, errorRate, avgDurationMs, p95DurationMs, topPaths, perDay }` | Aggregates over the whole table (or last N days). |
| GET | `/admin/logs` | `?limit&method&status&search&page` | `{ items, total, page }` | Filterable/paginated raw log list. |

Global logging (not under `/admin`):

- **`LoggerInterceptor`** registered as a global `APP_INTERCEPTOR`: captures `method`, `path`, `statusCode`, `durationMs`, `userId` (from `req.user` if present), `ip`, and `errorMessage` (only when `statusCode >= 400`). Buffers via `RPUSH log:buffer` in a `try/catch` — a logging failure must **never** fail the request.
- Excluded paths (noise / would pollute stats): `/api/health`, `/api/update/manifest`, and all `/admin` routes (incl. its HTML page). Kept out via an explicit skip list in the interceptor.

## 4. Business Rules & State Machine
- One `LogEntry` row per HTTP request (excluding the skip list above).
- `isError` derived as `statusCode >= 400`.
- `userId` populated only when the request carried a valid JWT (guarded routes); public routes → `null`.
- Duration measured with `tap()` on the response observable (includes full handler + stream).
- Logging is **buffered to Redis** (microseconds) and **flushed by the BullMQ job every 5 min**; a Redis/write failure never breaks the request (guarded try/catch).
- Stats computed from the `log_entries` table: total requests, error count + rate, avg & p95 duration, top-10 paths, per-day counts (last 7 days).
- No automatic retention/cleanup in MVP — table grows unbounded (a cleanup cron can be added later on request).

**Cache rules (referential Beranda/Profile reads):**
- Uses the same Redis instance; keyed `cache:{scope}:{resource}`, TTL ~60s.
- Caches only read endpoints that change rarely; invalidated on the corresponding mutations (write-through invalidation keyed per resource).

## 5. UI Spec (Self-hosted admin page)
Not React Native — this is a minimal HTML page served from the API (inline `<style>` + `<script>`, dark theme consistent with the app's ink/paper palette). Requirements:
- Stat cards row (total requests, errors, error rate, avg latency, p95 latency).
- Recent logs table (method, path, status, duration, user, timestamp) with client-side filter (method/status/text) and pagination via the `/admin/logs` endpoint.
- "Refresh" button re-fetching both endpoints.
- Responsive, single file, no external CDN dependencies (works offline on the VPS).

## 6. Constraints / Prohibited
- Do **not** touch the mobile app.
- Do **not** log bodies, query strings, headers, or passwords — path + method only (privacy).
- Logging must never break a request or add observable latency.
- No new project/package — everything lives in `apps/api`.
- `@Public()` is intentional and locked — do not add auth to `/admin` without asking the user first.

## 7. Dependencies
- Required read: `context/architecture/data-model.md` (add `LogEntry` first), `packages/db/prisma/schema.prisma`, `apps/api/src/app.module.ts` (global guards/interceptors), `common/decorators/public.decorator.ts`.

## 8. Status
Not yet implemented (context created 2026-08-07, pending build-plan registration).
