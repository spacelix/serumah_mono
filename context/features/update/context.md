# Feature Context — Update (In-App, Non-Store)

## 1. Goal & Scope

App distribution & update outside the store. Serumah is not on any app store — released via **GitHub Releases** (APK + `version.json` manifest). The app checks for updates each launch (release mode only).

## 2. Data Model

No DB tables. Uses:

- `version.json` on the GitHub release (manifest).
- APK `serumah-app.apk` on the release.

## 3. API / Configuration

- `UPDATE_MANIFEST_URL` (env `EXPO_PUBLIC_UPDATE_MANIFEST_URL`) → GitHub raw `version.json`.
- Repo: `https://github.com/spacelix/serumah_mono`.
- **Push announce** (dipicu GitHub Actions setelah release): `POST /update/announce` di API — body `{ versionName, notes }`, header `x-announce-secret` (env server `ANNOUNCE_SECRET`, GitHub secret `ANNOUNCE_SECRET`). Backend kirim push "Update Serumah {v} tersedia" ke semua anggota yang punya `pushToken`. Non-fatal kalau gagal.
- Manifest shape:

```json
{
  "versionCode": 2,
  "versionName": "1.0.1",
  "minVersionCode": 1,
  "apkUrl": "https://github.com/spacelix/serumah_mono/releases/download/v1.0.1/serumah-app.apk",
  "notes": "commit message of the tag"
}
```

- Compare with the installed version (expo-application):
  - installed `versionCode` ≥ manifest → up to date, no popup.
  - manifest `versionCode` newer → **optional** (can "Nanti saja").
  - manifest `minVersionCode` > installed → **force update** (cannot be skipped).
- Tap Update → download APK → install via file (Android: `REQUEST_INSTALL_PACKAGES` permission).

## 4. Business Rules & State Machine

Locked decisions:

- Check only in **release** mode, skip in debug/dev.
- Check once on app open (after first frame) + **re-check setiap app kembali aktif** (foreground) — supaya tap notif "update tersedia" memunculkan dialog walau app sudah berjalan.
- **Update selalu wajib (locked 2026-08-11):** dialog tidak punya tombol "Nanti saja", tidak bisa ditutup (non-dismissible), badge WAJIB selalu tampil. `onRequestClose` (tombol back) hanya re-check, tidak menutup.
- **Release trigger = tag `v*` pushed to GitHub** (locked decision, option 1). A plain commit/code change does NOT trigger an update — only bumping `app.json` version + pushing a `v{versionName}` tag starts the build.
- Release: bump version (app.json) → tag `v{versionName}` → GitHub Actions (`release.yml`) builds APK + generates `version.json` + publishes release.
- **Signed APK**: keystore from GitHub secrets (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`). No unsigned builds.

## 5. UI Spec (React Native)

- `UpdateDialog`: title "Update tersedia" + description "Versi sebelumnya tidak lagi didukung. Silakan perbaharui untuk melanjutkan." + badge **WAJIB** + progress bar while downloading. Hanya satu tombol: **"Update Sekarang"**. Tidak ada "Nanti saja", tidak bisa ditutup.
- Check in `app/_layout.tsx` (root) after mount + pada foreground (AppState).

## 6. Constraints / Prohibited

- No update check in debug/dev.
- Never force an update without a higher manifest `minVersionCode`.
- Do not keep the APK permanently — temporary directory.

## 7. Dependencies

- Required read: `core/code-standards.md` (env + storage).

## 8. Status

Implemented (M1, first phase after scaffold). App side done: `src/lib/update.ts` (manifest fetch + resolve optional/force + download via `File.downloadFileAsync` + install via `contentUri` intent), `useUpdateCheck` hook, `UpdateDialog` (WAJIB badge, progress bar, optional/force buttons), wired in `src/app/_layout.tsx` (release mode only, after first frame, dismissible optional). Theme tokens in `src/theme/`. CI done: `.github/workflows/release.yml` — trigger `push: tags: ['v*']`, `expo prebuild` + `gradlew assembleRelease` signed via keystore secrets, publishes `serumah-app.apk` + `version.json`. App: `android.package=com.serumah.serumah`, `versionCode: 1`, `REQUEST_INSTALL_PACKAGES` permission.

Pending: the M1 **test loop** — cut a test release, install older APK, verify in-app update prompt, update, confirm new version. Requires GitHub secrets (`KEYSTORE_*`, `EXPO_PUBLIC_API_URL`).
