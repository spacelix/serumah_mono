# Feature Context — Realtime (WebSocket)

## 1. Goal & Scope

Update status yang harus langsung tampil tanpa pull-to-refresh: request masuk (swap, submission piket), approve/reject (piket, denda, iuran), galon, dan status weekend. Implementasi: **Socket.io** (NestJS Gateway server → socket.io-client di mobile). Socket hanya pembawa pesan — **React Query tetap sumber kebenaran** (event → invalidate query).

## 2. Architecture

```
Server (NestJS Gateway)                 Client (socket.io-client)
  RealtimeGateway (global module)          lib/realtime.ts
  - handleConnection: JWT verify → join    - connectRealtime() (token JWT di auth)
  - emitToRumah(rumahId, event, payload)   - setupRealtimeListeners(queryClient)
        │                                        │
        └── room `rumah:{rumahId}` ←────────────┘  event → invalidate query
```

- **Auth**: token JWT dikirim di `handshake.auth.token`; server verify, resolve `anggota.rumahId`, join room `rumah:{id}`. Tanpa token / bukan anggota → disconnect.
- **Scope**: semua event per-rumah. Client hanya menerima event rumahnya sendiri.
- **Sumber kebenaran**: client tidak render data mentah dari socket — event hanya memicu `invalidateQueries`; UI tetap render dari React Query.

## 3. Events

| Event             | Pemicu (service)                                   | Invalidate query (mobile)                 |
| ----------------- | -------------------------------------------------- | ----------------------------------------- |
| `swap:updated`    | swap create / accept / reject                      | `['swap','list']`                         |
| `piket:updated`   | submission submit / approve / reject               | `['piket']`, `['dashboard']`              |
| `denda:updated`   | upload bukti / approve / reject                    | `['tagihan','denda']`                     |
| `iuran:updated`   | upload bukti total / confirmLunas                  | `['tagihan','iuran']`, `['tagihan','months']` |
| `galon:updated`   | galon confirm (rotate)                             | `['dashboard']`                           |
| `schedule:updated`| setWeekendStatus (Di kos/Pulang)                   | `['dashboard']`, `['schedule']`           |

Payload setiap event minimal `{ id?, status }` — cukup untuk memicu invalidate, tidak untuk render.

## 4. Files

- Server: `apps/api/src/modules/realtime/` (realtime.module.ts — Global, realtime.gateway.ts). Hook `emitToRumah` di: swap.service, piket.service, denda.service, iuran.service, galon.service, schedule.service.
- Client: `apps/mobile/src/lib/realtime.ts` (connect/disconnect/setup listeners), wired di `app/_layout.tsx` (connect saat `stage === 'ready'`, disconnect saat logout).
- Deps: `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io` (api); `socket.io-client` (mobile).

## 5. Constraints

- Hanya anggota rumah yang terdaftar menerima event rumah itu (JWT guard di gateway).
- Jangan render data dari socket langsung — selalu lewat React Query.
- Connect hanya saat login (`stage === 'ready'`); disconnect saat logout.
- CORS gateway `*` (di belakang traefik API server).
