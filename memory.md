# Memory — Serumah: iuran card redesign + password toggle + v1.7.1 (2026-08-10)

Last updated: 2026-08-10 (session end)

## What was built

**Uncommitted — Iuran front card redesign (mobile `app/(tabs)/tagihan.tsx`, typecheck green):**
- Iuran tab front now shows **ONE card** matching Serumah.html design: icon tile (34×34 paperDeep, `ReceiptText`) + label "Iuran Bulanan — {bulan}" + amount (mono 700 19, ink; inkSoft when lunas) + sub "Rp X ÷ N anggota aktif" + `<Stamp>` status (`belum_bayar`/`menunggu_konfirmasi`/`lunas`, derived from unpaid vs all-lunas) + "Upload Bukti Bayar" button (pine, only when `unpaid.length > 0`) → opens the aggregate upload sheet.
- Amount = `payTotal` (`unpaidTotal` if any unpaid, else `total`); sub = `payTotal × nAnggota ÷ nAnggota anggota aktif`.
- Upload sheet (unchanged flow) lists item per kategori (label + nominal) + bottom "Rp {amount} ÷ N anggota aktif" row (`uploadItems` block styles added: `uploadItems/uploadItemRow/uploadItemLabel/uploadItemAmount/uploadShare`).
- **CRITICAL UX decision (from user feedback):** front has summary + pay info unified into that ONE design card — NOT per-category cards on the tab. Per-category detail lives only inside the sheet.
- Old `iuranTotalCard`/`iuranSummary*`/`iuranPay*` styles removed; Iuran tab currently: RekeningCard → iuranCard → verify section (PJ).

**Uncommitted — password show/hide toggle + keyboard-cover fixes (mobile, typecheck green):**
- `components/ui/serumah-input.tsx` — `Eye`/`EyeOff` toggle rendered whenever `secureTextEntry` (`accessibilityLabel` "Tampilkan password"/"Sembunyikan password"), `paddingRight` 44. Auto-covers Login + Register password fields.
- `app/profile.tsx` — "Ganti password" card rebuilt with a `PasswordField` component (same toggle), replacing 3 raw inputs.
- **Keyboard-cover fixes (Android edge-to-edge ignored `padding`/`undefined`):** all centered auth/onboarding KAVs (`login`, `register`, `onboarding/profile`, `onboarding/create-rumah`, `onboarding/join-rumah`) → `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`.
- Scroll-based screens with inline inputs get KAV wrap + `keyboardShouldPersistTaps="handled"`: Kelola Rumah (`manage.tsx` — Tambah Ruangan / add-jenis), Profile (Ganti password), Tagihan (listrik record form). Added `flex` style + bumped `paddingBottom` in manage content.
- Docs: auth (toggle bullet), rumah + profile (keyboard bullet), `context/progress/progress-tracker.md` (session 2026-08-09 f), memory.md.

**Committed on `development`, 6 commits + tag `v1.7.1` (NOT pushed):**
- `28a5b42` **feat(api):** new `modules/tagihan` → `GET /tagihan/months` (`{ months: string[] }`, WIB months with data); `GET /denda` now returns `origin` (`auto`/`partial`/`rejected`) + `reviewerNama` + `tanggal` + `detail: { ruanganNama, fotoBefore, fotoAfter, jenisSelesai[], jenisList[] }[]` per-room cause.
- `698dafc` **feat(tagihan):** MonthPicker rebuilt as pill → bottom sheet "Pilih bulan" (riseIn 0.24s, only months with data); **QRIS-only payment** (no "Sudah Bayar Cash", no peer payment); payable denda card pressable → **`DendaDetailSheet`** (slide modal: cause per room + chips ✓pine/×brick, QRIS on top, "Upload Bukti Bayar" bottom).
- `10fa02f` **feat(mobile):** Piket gw `!isMine` → EmptyState "Hari ini giliran {nama}" (Cici no longer sees Admin Mawar's weekend piket); **`Stamp` gets `animate` prop** → stampIn (0.42s: -14° scale 1.6 → -4° .96 → -4° 1) only on approve/reject; **`QrisSection`** in Kelola Rumah (thumbnail for all, "Upload QRIS"/"Ganti QRIS" admin → galeri, no crop); Kelola Rumah open to ALL members (view-only for non-admin; invite row admin-only).
- `b9ead8d` **fix(mobile):** root Stack `animation: 'slide_from_right'` scoped to `profile`+`rumah/manage`; theme `background`+`card` = `colors.paper` (#EFEAE0); root View paper; `detachInactiveScreens={false}` on Tabs (fixes blank-paper flash on pop); avatar chip hidden on subscreens (`showChip = showAvatar ?? onBack == null`).
- `c97eb93` **build(mobile):** bump **1.7.1 / versionCode 11**; splash minimum 1400→**2400ms**; release APK now **arm64-v8a only + R8 minify + shrinkResources** (`-P` flags in `release.yml`); paper window bg via **`expo-system-ui`** plugin in app.json (`android.backgroundColor: #EFEAE0`) — survives prebuild (android/ is gitignored & regenerated, so manual styles.xml edits are lost).
- `b9ead8d`'s docs friend `ecef18b` **docs:** contexts synced (denda/piket/rumah/profile) + progress-tracker + memory.md.

## Decisions made

- **QRIS-only denda payment (locked):** no cash/peer payment anywhere. Member uploads bukti transfer → `menunggu_konfirmasi` → PJ approve. PJ's own fine auto-`lunas`.
- Denda rejected = `· direject {nama}`; partial = `· direview {nama}`; auto = `· auto-denda deadline 20:00`.
- All image pickers now **gallery, no crop** (`launchImageLibraryAsync` without `allowsEditing`).
- stampIn animation ONLY for approve/reject stamps, not pending/status ones.
- Release APK arm64-v8a only (modern devices; pre-2017 32-bit unsupported — revisit if needed).
- Android window background must be set via `expo-system-ui` app.json plugin (prebuild regenerates `android/`, gitignored).
- Password fields: default hidden, toString → eye icon toggles `secureTextEntry` (both `SerumahInput` and profile `PasswordField`).
- **Iuran front = ONE design card (user-confirmed, NOT per-kategori):** summary + "yang harus dibayar" are combined into a single card (icon tile + label + share amount + "Rp N ÷ N anggota aktif" sub + Stamp + Upload button). Per-category item rows live only in the upload sheet. No per-category detail sheet — "Upload Bukti Bayar" per-card opens the aggregate upload sheet (all-or-nothing bukti total, locked).

## Problems solved

- **Keyboard covering inputs on Android edge-to-edge** — centered forms with `behavior undefined/padding` did nothing; `'height'` is the fix. Scroll-based inputs need KAV wrap + `keyboardShouldPersistTaps="handled"` so taps reach buttons behind an open keyboard.
- **White/paper flash on subscreen transitions** — four layers: React Navigation theme `background`+`card`→paper, `contentStyle` paper, `detachInactiveScreens={false}` on Tabs, `expo-system-ui` `android.windowBackground` (root cause).
- **Render Error "DendaDetailSheet doesn't exist"** — duplicate `uploadBtn`/`uploadBtnText` style keys broke the whole `styles` object (StyleSheet.parse failure). Removed dup.
- **100MB+ APK** — universal APK bundled 4 ABIs + no R8. Fixed via arm64-only + minify/shrink in `release.yml`.
- **Splash too fast** — `minimum` hold 1400→2400ms so riseIn+wordmark animation reads.

## Current state

- **Uncommitted working tree:** (a) iuran front card redesign in `app/(tabs)/tagihan.tsx`; (b) password toggle + keyboard fixes. Mobile typecheck clean via `bunx tsc --noEmit`; full build verification pending in sandbox; needs per-item commits.
- All prior work committed on `development`, tag `v1.7.1`. **Push pending from Windows**: `git push origin development && git push origin v1.7.1` → triggers `release.yml`.
- Per AGENTS.md: commit per verified item; hand user the exact commands (`bun run lint && bun run typecheck && bun run test` inside `apps/mobile`).

## Next session starts with

1. **Finish uncommitted items:** user confirms `bun run lint && bun run typecheck && bun run test` green → commit iuran card redesign as one item, password/keyboard fixes as another (each with docs + memory update in same commit).
2. **Push from Windows** (WSL SSH rejected): `git push origin development && git push origin v1.7.1`.
3. Confirm GitHub Actions build for v1.7.1 → check APK size (expect arm64-only ~40-50MB vs 100MB+) and test in-app update on device.
4. Sanity-check redesigned iuran card on device (stamp statuses, "Rp N ÷ N anggota aktif" sub, sheet items) against Serumah.html.
5. Continue Phase M5 remaining: Swap tab verification against design; Iuran/Listrik month-filter flows.

## Open questions

- None blocking.