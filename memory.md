# Memory — Serumah: Push via Expo Push Service, best practice audit, akan pindah D:\sm (2026-08-10)

Last updated: 2026-08-10 (late session)

## What was built (sesi ini)

**Semua committed di `development`; TIDAK push — push dari Windows + project akan dipindah ke `D:\sm`.**

- `7d4dd25` **refactor(notif):** pindah dari FCM HTTP v1 → **Expo Push Service** (best practice): `FcmService` kini `POST exp.host/--/api/v2/push/send` tanpa auth; mobile pakai `getExpoPushTokenAsync`. FCM env (`FCM_PROJECT_ID` dll) dihapus dari backend — tidak dipakai.
- `ad93014` **fix(notif):** `getExpoPushTokenAsync({ projectId })` eksplisit (`expoProjectId()` dari `extra.eas.projectId`/`EXPO_PUBLIC_EAS_PROJECT_ID`); log push di-gate `__DEV__` (token tidak bocor); dedup parser deep-link (`routeForDeepLink` tunggal).
- `6cb7825` **chore:** hapus `react-native-reanimated` + `react-native-worklets` dari `apps/mobile/package.json` — TAPI keduanya tetap ada sbg transitive dep (`expo-modules-core` wajib worklets, `react-native-gesture-handler` wajib reanimated). Jadi **tidak menyelesaikan path CMake**.
- `2850239` **refactor(permission):** `lib/media-permissions.ts` baru — `ensureCameraPermission()`/`ensureMediaLibraryPermission()` check-then-request sekali + `Linking.openSettings()` saat denied. Dipakai di 6 lokasi (profile, rumah/manage, onboarding/profile, piket, tagihan).
- `08f8e20` **refactor:** `useAnimatedValue(0)` di toaster + splash (ganti `useMemo(new Animated.Value)` — React Compiler friendly).
- `30a42d4` **docs:** README + notifications context → Expo Push Service, `EXPO_PUBLIC_EAS_PROJECT_ID`.
- `32ced46` **chore:** `eas init` → `extra.eas.projectId` (`c033064a-0913-42d1-9218-e8a84297ab93`) + `owner: xavierxxs` di `apps/mobile/app.json`. Root `app.json` duplikat (salah lokasi dr eas init) **dihapus**.
- `c44aad3` **fix(notif):** `lib/notifications.ts` refactor — **dynamic import** `expo-notifications` + guard `inExpoGo()` (Constants.appOwnership === 'expo'). `setupNotifications()` (handler foreground + channel + deep-link listener), `registerPushToken`, `clearPushToken`. App tetap jalan di Expo Go untuk fitur non-push.

**Notif debugging backend** (sebelum pindah ke Expo Push): `90a7fd1` exchange JWT→access token, `d51bf60` SHA-256 hash, `c2affa4` aud fcm, `7a45476` normalize `\n` — semua obsolete setelah `7d4dd25` (Expo Push Service), tinggal di history.

## Decisions made

- **Push = Expo Push Service** (best practice resmi): backend kirim ke `exp.host`, Expo relay ke FCM/APNs. Backend TIDAK butuh FCM credentials. Mobile butuh `extra.eas.projectId` (sudah ada) + `google-services.json` + FCM V1 key di EAS (build app, bukan server).
- **Expo Go tidak bisa push Android** (SDK 53+) — guard `inExpoGo()` biar app jalan untuk dev non-push.
- Release APK arm64-v8a only; emulator x86_64 tidak bisa install → test push via dev build x86_64 / device fisik.
- **Tetap build via GitHub Actions** (gratis, tanpa batas) — EAS build tidak wajib; `eas init` hanya utk projectId. iOS butuh $99/tahun (Apple Developer) jika mau device fisik.
- `Anggota.push_token` satu-satunya penyimpan token; tabel `fcm_tokens` dihapus.

## Problems solved

- Push tidak jalan: FCM HTTP v1 JWT auth (UNAUTHENTICATED → Invalid grant) → ganti **Expo Push Service** (hapus semua kerumitan JWT).
- Expo Go error "Push removed from Expo Go" → dynamic import + guard `inExpoGo`.
- Izin notif tidak muncul → re-ask `denied` + register tiap app start.
- **Build lokal Windows masih gagal** (path `.bun` >250 CMake, `build.ninja still dirty`): hapus reanimated/worklets TIDAK cukup (masih transitive dep). `buildStagingDirectory` app-level tidak sentuh module reanimated. **Solusi nyata: pindah project ke path pendek — `D:\sm`.** CI (path pendek) sudah build sukses.
- Expo Go dev-client error `exp+serumah://expo-development-client` → buka dev build via Metro (`expo start` → `a`), bukan dari icon.

## Current state

- All committed di `development`; **push pending dari Windows** (`git push origin development --tags`), akan dilakukan setelah pindah ke `D:\sm`.
- Secret `GOOGLE_SERVICES_BASE64` sudah di-set user di GitHub Actions.
- `extra.eas.projectId` + `owner` ada di `apps/mobile/app.json`.
- Migrasi belum apply di DB: `drop_fcm_tokens`, `add_push_token` — butuh `prisma migrate dev`.
- **Project akan dipindah ke `D:\sm`** (clone ulang atau pindah folder) untuk solve build lokal Windows.

## Next session starts with

1. **Pindah project ke `D:\sm`** (path pendek). Cara: clone ulang di `D:\sm`, atau pindahkan folder; lalu `bun install`, `Remove-Item -Recurse -Force android`, `bunx expo run:android`. Ini seharusnya build lokal sukses (path CMake aman).
2. Push `development --tags` dari Windows (setelah pindah).
3. Apply migrasi: `cd packages/db && bunx prisma migrate dev`.
4. Test push end-to-end di device fisik: install APK (google-services + projectId ter-inject) → login → `logcat [notifications]` → cek `anggota.push_token` terisi `ExponentPushToken[...]` → trigger notif (galon nudge/piket/denda).
5. Set `EXPO_PUBLIC_EAS_PROJECT_ID` di `apps/mobile/.env` LOKAL (untuk dev di luar EAS build) — meski `extra.eas.projectId` sudah cukup.

## Open questions

- Path build lokal: `D:\sm` cukup pendek? (perlu <~30 char root utk aman dgn `.bun` redundan).
- Test push end-to-end belum diverifikasi (masih butuh test di device fisik setelah build sukses).
- Revisi swap (sudah lama direncanakan) belum dikerjakan — prioritas berikutnya setelah build jalan.
