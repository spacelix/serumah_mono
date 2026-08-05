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
- Check once on app open (after first frame).
- Force update: non-dismissible dialog.
- **Release trigger = tag `v*` pushed to GitHub** (locked decision, option 1). A plain commit/code change does NOT trigger an update — only bumping `app.json` version + pushing a `v{versionName}` tag starts the build.
- Release: bump version (app.json) → tag `v{versionName}` → GitHub Actions (`release.yml`) builds APK + generates `version.json` + publishes release.
- **Signed APK**: keystore from GitHub secrets (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`). No unsigned builds.

## 5. UI Spec (React Native)
- `UpdateDialog`: title "Update tersedia" + description + progress bar while downloading. Optional → "Nanti saja" + "Update Sekarang" buttons. Force → only "Update Sekarang".
- **WAJIB** badge for forced updates.
- Check in `app/_layout.tsx` (root) after mount.

## 6. Constraints / Prohibited
- No update check in debug/dev.
- Never force an update without a higher manifest `minVersionCode`.
- Do not keep the APK permanently — temporary directory.

## 7. Dependencies
- Required read: `core/code-standards.md` (env + storage).

## 8. Status
Not yet implemented (M1 — first phase after scaffold). Parity with the GitHub-release flow from the Flutter era (`/mnt/d/Source/serumah/.github/workflows/release.yml`), adapted to Expo/RN: trigger stays `push: tags: ['v*']`, build via `expo prebuild` + `gradlew assembleRelease` with keystore secrets.
