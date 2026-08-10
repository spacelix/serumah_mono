# Memory — Serumah: swap mutual, reviewer denda/iuran, listrik, schedule, v1.7.1 (2026-08-10)

Last updated: 2026-08-10 (session end)

## What was built

**All committed on `development` (8 commits, since `v1.7.1` tag, NOT pushed — push from Windows):**
- `30dd4b6` **feat(db):** payment reviewerId on Denda + IuranBulanan (migration `add_payment_reviewer`); SwapRequest + `tanggalKe` (migration `swap_mutual_two_day`).
- `d53b6d9` **feat(api):** `RumahScopeService.assignPaymentReviewer` (member→PJ, PJ→round-robin non-PJ; **PJ's own denda/iuran payment NO LONGER auto-lunas** — goes `menunggu_konfirmasi` + assigned reviewer); approve/reject/confirmLunas validate `reviewerId` (not `@Roles('admin')`). **Listrik even split**: `base=floor(nominal/n)`, sisa rupiah dibagikan rata (rotasi per record), tiap record return `shares: {memberId→share}` + `share` (user's own). **Schedule `selfHealWeek` cron harian 06:00** → ensure current week today→Sunday (idempoten, no past); fixes "Senin tidak tergenerate kalau cron Sabtu terlewat".
- `bf9ddc6` **feat(api):** swap mutual 2-hari — `POST /swap` `{tanggal, tanggalKe, keAnggotaId}` (validasi kedua hari punya jadwal piket milik masing-masing); `accept` saling pindahkan kedua jadwal; endpoint baru `GET /swap/target-days` → `{id, nama, days[]}[]`.
- `0f1c16b` **feat(swap):** mobile `swap.tsx` di-rebuild — header kicker "All-or-nothing · 1 hari penuh"; CTA dashed "Ajukan swap baru" (hilang saat form terbuka); form **dark bottom sheet 2-step** (step 1 pilih hari lo dari `available-days` → step 2 pilih hari anggota lain dari `target-days` + "← Ganti hari lo"); kartu incoming "Request masuk" + waktu relatif + dua `DayBox` + ⇄ pine + note + Terima(ink)/Tolak(outline); section **Histori swap · buat audit** (Request lo + stamp). `members.ts` (useIuranMembers) dihapus → `useSwapTargets`.
- `b34f25c` **feat(tagihan):** denda/iuran pending filter `reviewerId === myId` (bukan isPj); label "Kirim ke reviewer" (PJ) / "Kirim ke PJ" (member); denda card waitNote "nunggu konfirmasi {reviewerNama}" + **"Lihat Detail" button** untuk `menunggu_konfirmasi`/`lunas`; `IuranDetailSheet` (read-only, desain sama upload sheet: header title+amount+stamp kanan, items, bukti, **timeline**); `IuranVerifySheet` (sama desain detail, tanpa timeline, button **"Lunas"**); **Listrik**: summary tanpa progress bar + note rule "Listrik tambahan dibagi rata ke semua. Pembeli dapet kredit, non-pembeli ditambah di tagihan bulan depan." (mono 400 11 pineDeep); button "Tambah Record" dashed; `ListrikFormCard` (top-level, rise-in/out, Rp field kecil, foto preview+clear, preview modal dgn "Ganti foto"); `ListrikRecordCard` (avatar initial pine, nama+tanggal, amount brick, thumb bukti striped) + `ListrikDetailSheet` (foto stripes "pinch buat zoom", info card, share box, kredit/tagihan box).
- `140f2f8` **feat(mobile):** `EmptyState` action button → dashed (paperDeep/lineDash/pine); `Stamp` `menunggu_konfirmasi` → 2-line "MENUNGGU\nKONFIRMASI" (maxWidth 82, center); Kelola Rumah room card **move up ↑** (sebelumnya hanya down); Beranda **banner "Jadwal piket pekan ini belum dibuat" dihapus** (empty state sudah ada).
- `0168cde` **docs:** swap context (mutual 2-day), schedule context (self-heal cron), data-model (tanggalKe), progress-tracker.

## Decisions made

- **Swap = mutual 2-hari (locked 2026-08-10):** bukan transfer 1 hari. Hari pengaju → penerima, hari penerima → pengaju.
- **PJ payment tidak auto-lunas (locked 2026-08-10):** denda + iuran milik PJ di-review round-robin member lain.
- **Listrik split** sisa rupiah dibagi rata (selisih maks Rp 1/orang), dirotasi per record; kredit pembeli = `nominal − share`, tagihan non-pembeli = `share`.
- Cron harian self-heal (06:00) menutup celah pregenerate Sabtu yang terlewat.
- UI denda: note rejected = `· direject {nama}`; partial = `· direview {nama}`; auto = `· auto-denda deadline 20:00`.

## Problems solved

- Senin jadwal tidak tergenerate karena cron Sabtu single-fire → daily self-heal idempoten (tidak generate hari lampau).
- Swap UI (one-way) vs design (mutual 2-hari) mismatch → backend jadi mutual.
- PJ denda/iuran auto-lunas (self-confirmation) → reviewer round-robin.
- Listrik `floor` membuat pembeli selalu menyerap sisa → sisa dibagi rata.
- Card form listrik re-render tiap ketik (nested component) → di-extract jadi top-level.

## Current state

- All committed on `development`; **push pending dari Windows**: `git push origin development` (+ tag v1.7.1 jika belum). Belum ada tag baru untuk commit di atas.
- Working tree clean. `memory.md` ter-update (belum di-commit — file sesi; kalau mau masuk git, commit terpisah).

## Next session starts with

1. **Push dari Windows** (WSL SSH ditolak): `git push origin development && git push origin v1.7.1`.
2. Pastikan migrasi sudah di-apply lokal: `cd packages/db && bunx prisma migrate dev` (folder migrasi `add_payment_reviewer` + `swap_mutual_two_day` sudah ada; user harus jalankan) lalu `bun run generate && bun run build`.
3. Uji flow swap mutual end-to-end (form 2-step, accept pindah kedua jadwal), reviewer denda/iuran (PJ bayar → menunggu konfirmasi member lain), listrik split.
4. Lanjut Phase M5: verifikasi tab Swap & Tagihan di device; kalau perlu bump version + tag baru.

## Open questions

- Push tag v1.7.1 sudah ter-push? (release CI APK arm64 ~40-50MB) — cek GitHub Actions.
- `formatWeekdayDate` memberi "Kam 30 Jul" tanpa koma vs design "Kam, 30 Jul" — kosmetik kecil, belum diubah.
