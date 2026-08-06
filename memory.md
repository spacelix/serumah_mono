# Memory — Serumah: UI Header Revision underway + login fixes (uncommitted)

Last updated: 2026-08-06

## What was built

- **Debug rute API**: setting emulator pakai `10.0.2.2` (bukan `localhost`) sudah benar di `apps/mobile/.env` (`EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api`) — sudah wajib.
- **Fix bug login (401 "Sesi berakhir"):** `apiMe()` dipanggil sebelum token disimpan ke Zustand store, jadi request `/auth/me` keluar tanpa header `Authorization`. Diusulkan imbalance di `stores/auth-store.ts` → `apiMe(session.token)`; `features/auth/api/auth.ts` → `apiMe(token?)` menyisipkan header `Bearer` eksplisit.
- **Fix "No QueryClient set":** root `_layout.tsx` selamanya membungkus `QueryClientProvider` (sebelumnya tidak ada sama sekali) dengan `new QueryClient` + `defaultOptions`.
- **Diagnostic log JWT:** `apps/api/src/common/guards/jwt-auth.guard.ts` kini log `reason` + `hasAuthHeader` saat 401.
- **Revisi UI Header (berjalan):** komponen reusable baru `apps/mobile/src/components/ui/screen-header.tsx` (`ScreenHeader` + `AvatarChip`), mengikuti desain: kicker mono `PAPAN PIKET · <nama kos>` + judul Space Grotesk 25px kiri + avatar chip kanan; sub-screen pakai prop `onBack`. Diterapkan ke 6 screen: Beranda, Piket, Tagihan, Swap, Profil, Kelola Kos (`app/profile.tsx`, `app/rumah/manage.tsx`, `app/(tabs)/{index,piket,tagihan,swap}.tsx`). Header dijadikan sibling (di luar ScrollView) dengan padding sendiri `12/20/10` agar tidak mepet ujung layar — sejak sebelumnya Tagihan & Profil tak punya inset sisi.

## Decisions made

- **Emulator Android** memakai `10.0.2.2` → host. `EXPO_PUBLIC_*` di-inline saat build; restart `bun expo start` stih ganti `.env`.
- Screen header tim core: `paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10`, di orang kanan chip avatar. Kicker pakai `useProfile()` (query-cache `profile/me`) — jadi tidak perlu prop rumahName dari tiap layar.
- Native Android build masih dibawa ke Windows (dari sesi lalu) — tidak px beberapa di WSL.
- Janam Header (logo+mark) lama dihapus dari tab screen; `SerumahLogo` masih dipakai di `(auth)`.

## Problems solved (this session)

- 401 bukan karena expired token: dengan log baru terbukti `hasAuthHeader=false` — request tanpa token karena `apiMe` dipanggil sebelum `setSession`.
- Root app crash "No QueryClient set" karena `QueryClientProvider` tidak dibungkus di `_layout.tsx`.
- Header tab mepet sebelah screen karena header diposisikan di level `SafeAreaView` tanpa padding; solusi: beri padding 20 pada komponen & jadikan header sibling konsisten.

## Current state

- **M0–M5 sudah commit & green. Phase tracker: M5; Next Phase M6 (belum diapprove).**
- Semua perubahan proyek ini **BELUM di-commit** (`git status`): api guard, login fix (auth-store/auth.ts), `_layout.tsx`, revisi header 5 file + screen-header.tsx (untracked). sql; bun.lock sengaja tidak ikut.
- `bunx tsc --noEmit` di apps/mobile **hijau**. `eslint` tidak terinstal lokal (env belum install devDeps) — lint tidak bisa jalan di WSL.
- Expo Go dev server: `cd apps/mobile && bun expo start`. Backend: `bun run start:dev` di apps/api (pastikan `@serumah/db` dibuild dulu).

## Next session starts with

1. **Commit perubahan yang sedang berjalan** — paling logis split jadi 2 item: (a) fix bug koneksi/login (auth.ts, auth-store.ts) + QueryClientProvider layout + debug jWT guard; (b) revisi header. Menunggu keputusan user bagaimana pemecahan commit.
2. **Lanjutkan revisi UI Header** — validasi tampilan di emulator (inset 20px, rasa nyaman). Konfirmasi kalau ada layar lain yang perlu header (mis. kursus/booking?).
3. Phase gating: konfirmasi dengan user sebelum lanjut Phase M6.

## Open questions

- Bagaimana user ingin memecah commit (bug fix vs header rev).
- `eslint` belum terpasang lokal — perlu `bun install` di workspace mobile atau lewat turbo.
- Phase M6 scope masih belum disetujui (stop & ask dahulu).