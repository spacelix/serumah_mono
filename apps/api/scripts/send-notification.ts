/**
 * CLI interaktif untuk test kirim push notification (Expo Push Service).
 *
 * Jalankan:
 *   bun run notif:test
 *
 * Alur:
 *   1. Wajib pilih rumah (list dari DB) — token dibaca per anggota rumah itu.
 *   2. Pilih skenario: broadcast (semua anggota) atau target (spesifik anggota).
 *   3. Untuk skenario yang butuh anggota spesifik → pilih anggota dari list
 *      rumah yang sama (atau ketik userId). Token diambil dari `Anggota.pushToken`.
 *   4. Isi title/body (default sudah disediakan per skenario) → kirim via Expo.
 *
 * Tidak butuh NestJS runtime — langsung `PrismaClient` + `fetch` ke Expo.
 */
import './lib/env'; // side-effect: load DATABASE_URL sebelum @serumah/db
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { prisma } from '@serumah/db';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

interface Skenario {
  key: string;
  label: string;
  /** true = user wajib pilih 1 anggota; false = broadcast ke semua anggota. */
  targetAnggota: boolean;
  title: string;
  body: string;
  deepLink?: string;
}

const SKENARIO: Skenario[] = [
  {
    key: 'weekend-status',
    label: 'Status weekend berubah (Di kos/Pulang) → semua anggota lain',
    targetAnggota: false,
    title: 'Status akhir pekan',
    body: '{nama} pilih Di kos untuk Sabtu.',
    deepLink: '/',
  },
  {
    key: 'weekend-missed',
    label: 'Belum konfirmasi saat freeze → anggota spesifik',
    targetAnggota: true,
    title: 'Status akhir pekan lo belum dipilih',
    body: 'Lo ga konfirmasi Pulang atau Di kos, jadi buat weekend ini lo bertanggung jawab sepenuhnya.',
    deepLink: '/',
  },
  {
    key: 'galon-bought',
    label: 'Galon dibeli → semua anggota (selain pembeli)',
    targetAnggota: false,
    title: 'Galon udah dibeli',
    body: '{nama} udah beli galon — giliran berikutnya {namaBerikutnya}.',
    deepLink: '/',
  },
  {
    key: 'galon-nudge',
    label: 'Nudge giliran galon → anggota spesifik',
    targetAnggota: true,
    title: 'Giliran galon lo',
    body: 'Galon udah saatnya dibeli — giliran lo sekarang.',
    deepLink: '/',
  },
  {
    key: 'piket-review',
    label: 'Piket nunggu verifikasi → reviewer spesifik',
    targetAnggota: true,
    title: 'Piket nunggu verifikasi',
    body: '{nama} ngirim piket buat diverifikasi.',
    deepLink: '/(tabs)/piket',
  },
  {
    key: 'swap-incoming',
    label: 'Swap masuk → penerima spesifik',
    targetAnggota: true,
    title: 'Permintaan swap masuk',
    body: '{nama} mau tukar jadwal piket sama lo.',
    deepLink: '/(tabs)/swap',
  },
  {
    key: 'denda-reminder',
    label: 'Denda belum bayar → anggota spesifik',
    targetAnggota: true,
    title: 'Denda belum dibayar',
    body: 'Lo punya 1 denda belum dibayar, total Rp 50.000.',
    deepLink: '/(tabs)/tagihan',
  },
  {
    key: 'custom',
    label: 'Custom — isi title/body sendiri (pilih target)',
    targetAnggota: true,
    title: '',
    body: '',
    deepLink: '/',
  },
];

function bold(text: string): string {
  return `\x1b[1m${text}\x1b[0m`;
}

function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`;
}

function green(text: string): string {
  return `\x1b[32m${text}\x1b[0m`;
}

async function ask(rl: readline.Interface, prompt: string): Promise<string> {
  return (await rl.question(prompt)).trim();
}

async function pilihRumah(rl: readline.Interface): Promise<{
  id: string;
  nama: string;
}> {
  const rumahs = await prisma.rumah.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, nama: true },
  });
  if (rumahs.length === 0) {
    console.error('Belum ada rumah di database.');
    process.exit(1);
  }

  console.log(`\n${bold('Pilih rumah:')}`);
  rumahs.forEach((r, i) => console.log(`  ${i + 1}. ${r.nama} ${dim(`(${r.id})`)}`));

  for (;;) {
    const raw = await ask(rl, `  Nomor [1-${rumahs.length}] atau id rumah: `);
    const byIndex = Number(raw);
    if (Number.isInteger(byIndex) && byIndex >= 1 && byIndex <= rumahs.length) {
      return rumahs[byIndex - 1]!;
    }
    const byId = rumahs.find((r) => r.id === raw);
    if (byId) return byId;
    console.log('  Input tidak valid, coba lagi.');
  }
}

async function pilihAnggota(
  rl: readline.Interface,
  rumahId: string,
): Promise<{ id: string; nama: string; pushToken: string | null }> {
  const members = await prisma.anggota.findMany({
    where: { rumahId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, nama: true, pushToken: true },
  });
  if (members.length === 0) {
    console.error('Rumah ini belum punya anggota.');
    process.exit(1);
  }

  console.log(`\n${bold('Pilih anggota:')}`);
  members.forEach((m, i) => {
    const token = m.pushToken ? green('●') : dim('○');
    console.log(`  ${i + 1}. ${token} ${m.nama} ${dim(`(${m.id})`)}`);
  });
  console.log(dim('  ● = punya push token · ○ = tidak punya'));

  for (;;) {
    const raw = await ask(rl, `  Nomor [1-${members.length}] atau userId: `);
    const byIndex = Number(raw);
    if (Number.isInteger(byIndex) && byIndex >= 1 && byIndex <= members.length) {
      return members[byIndex - 1]!;
    }
    const byId = members.find((m) => m.id === raw);
    if (byId) return byId;
    console.log('  Input tidak valid, coba lagi.');
  }
}

async function pilihSkenario(rl: readline.Interface): Promise<Skenario> {
  console.log(`\n${bold('Pilih skenario:')}`);
  SKENARIO.forEach((s, i) => console.log(`  ${i + 1}. ${s.label}`));

  for (;;) {
    const raw = await ask(rl, `  Nomor [1-${SKENARIO.length}]: `);
    const idx = Number(raw);
    if (Number.isInteger(idx) && idx >= 1 && idx <= SKENARIO.length) {
      return SKENARIO[idx - 1]!;
    }
    console.log('  Input tidak valid, coba lagi.');
  }
}

async function kirim(
  token: string,
  title: string,
  body: string,
  deepLink: string,
): Promise<boolean> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data: { deepLink } }),
  });
  const json = (await res.json()) as {
    data?: { id?: string; status?: string; message?: string }[];
  };
  const ticket = json?.data?.[0];
  if (ticket?.status === 'error') {
    console.log(`  ${dim('→')} Expo error: ${ticket.message ?? ticket.status}`);
    return false;
  }

  // Expo mengembalikan status delivery di RECEIPT (bukan ticket). Ticket "ok"
  // hanya berarti request diterima — DeviceNotRegistered baru terlihat di sini.
  if (ticket?.id) {
    await sleep(1500);
    try {
      const r = await fetch(EXPO_RECEIPTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [ticket.id] }),
      });
      const rr = (await r.json()) as {
        data?: Record<string, { status: string; message?: string }>;
      };
      const receipt = rr?.data?.[ticket.id];
      if (receipt && receipt.status === 'error') {
        console.log(
          `  ${dim('→')} Receipt error: ${receipt.message ?? receipt.status} (token basi?)`,
        );
        return false;
      }
    } catch (e) {
      console.log(
        `  ${dim('→')} Gagal cek receipt: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const rl = readline.createInterface({ input, output });
  try {
    console.log(bold('\n=== Serumah · Test Push Notification ==='));

    const rumah = await pilihRumah(rl);
    console.log(`\nRumah terpilih: ${green(bold(rumah.nama))}`);

    const skenario = await pilihSkenario(rl);
    console.log(`\nSkenario: ${bold(skenario.label)}`);

    // ── Tentukan penerima ──────────────────────────────────────────────
    let targetIds: string[];
    if (skenario.targetAnggota) {
      const anggota = await pilihAnggota(rl, rumah.id);
      targetIds = [anggota.id];
    } else {
      const members = await prisma.anggota.findMany({
        where: { rumahId: rumah.id },
        select: { id: true },
      });
      targetIds = members.map((m) => m.id);
    }

    const members = await prisma.anggota.findMany({
      where: { id: { in: targetIds } },
      select: { id: true, nama: true, pushToken: true },
    });

    // ── Isi title/body ─────────────────────────────────────────────────
    let title = skenario.title;
    let body = skenario.body;
    if (skenario.key === 'custom') {
      title = await ask(rl, '  Title: ');
      body = await ask(rl, '  Body: ');
    } else {
      if (body.includes('{nama}')) {
        const nama = members[0]?.nama ?? 'Dani';
        body = body.replace('{nama}', nama);
      }
      if (body.includes('{namaBerikutnya}')) {
        body = body.replace('{namaBerikutnya}', 'Gilang');
      }
    }
    const deepLink = skenario.deepLink ?? '/';

    // ── Konfirmasi & kirim ─────────────────────────────────────────────
    const punyaToken = members.filter((m) => m.pushToken);
    console.log(
      `\nPenerima: ${members.length} anggota (${punyaToken.length} punya push token).`,
    );
    if (punyaToken.length === 0) {
      console.error(
        'Tidak ada anggota dengan push token — tidak ada yang bisa dikirim.',
      );
      return;
    }
    if (title === '') {
      console.error('Title tidak boleh kosong.');
      return;
    }

    const confirm = await ask(rl, `\nKirim "${title}" ke ${punyaToken.length} device? [y/N]: `);
    if (confirm.toLowerCase() !== 'y') {
      console.log('Dibatalkan.');
      return;
    }

    console.log('');
    for (const m of members) {
      if (!m.pushToken) {
        console.log(`${dim('○')} ${m.nama} — tidak punya token, dilewati`);
        continue;
      }
      const ok = await kirim(m.pushToken, title, body, deepLink);
      console.log(
        ok
          ? `${green('✓')} ${m.nama} — ${dim(title)}`
          : `  ${m.nama} — gagal`,
      );
    }
    console.log('\nSelesai.');
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
