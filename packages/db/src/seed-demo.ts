/**
 * DEMO SEED — untuk menguji alur "jadwal habis → empty state + notif PJ".
 *
 * Membuat rumah terpisah ("Kos Demo") dengan user baru (bukan user produksi):
 *   - PJ:   pj.demo@serumah.app  (password123)
 *   - A:    demo.a@serumah.app   (password123)
 *   - B:    demo.b@serumah.app   (password123)
 *
 * Jadwal weekday (Sen/Rab/Jum) di-generate dari masa lalu SAMPAI HARI INI
 * saja (hari terakhir = hari ini). Setelah hari ini TIDAK ada jadwal → cron
 * `scheduleExhaustedReminder` (22:00) akan mendeteksi jadwal habis → notif PJ.
 *
 * Hari ini di-resolve dari WIB (UTC+7), jadi seed ini tetap valid kapan pun
 * dijalankan (tidak hardcode tanggal).
 *
 * Jalankan:  bun run db:seed:demo
 */
import 'dotenv/config';
import { prisma } from './client';
import type { User } from '../generated/client/index.js';

const DEMO_RUMAH = 'Kos Demo';
const DEMO_INVITE = '555999';

// UUID deterministik terpisah dari seed utama (awalan 0d) — tidak bentrok
// dengan user produksi / Kos Mawar.
const pjId = '00000000-0000-0000-0000-0000000d0001';
const memberIds = {
  a: '00000000-0000-0000-0000-0000000d0002',
  b: '00000000-0000-0000-0000-0000000d0003',
};

const DEMO_PASSWORD_HASH =
  '$2b$10$nxMD2bdAaEOXsUaJ5X3bzeg0E33p39JunhF9w6sgwCl6cfBCac2.a'; // password123

const ROOMS = [
  {
    id: '00000000-0000-0000-0000-0000000d00b1',
    nama: 'Ruang Tamu',
    urutan: 1,
    jenis: [
      { id: '00000000-0000-0000-0000-0000000d00c1', nama: 'Sapu' },
      { id: '00000000-0000-0000-0000-0000000d00c2', nama: 'Pel' },
    ],
  },
  {
    id: '00000000-0000-0000-0000-0000000d00b2',
    nama: 'Dapur',
    urutan: 2,
    jenis: [
      { id: '00000000-0000-0000-0000-0000000d00c3', nama: 'Sapu' },
      { id: '00000000-0000-0000-0000-0000000d00c4', nama: 'Cuci piring' },
    ],
  },
];

// WIB (UTC+7). `@db.Date` disimpan dari komponen UTC.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const PIKET_WEEKDAYS = [1, 3, 5]; // Senin, Rabu, Jumat

function todayWib(): Date {
  const now = new Date();
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  return new Date(
    Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()),
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days,
    ),
  );
}

const roomNames = ROOMS.map((r) => r.nama);

function makeUser(id: string, email: string): User {
  return { id, email, passwordHash: DEMO_PASSWORD_HASH } as User;
}

async function main() {
  const users = [
    makeUser(pjId, 'pj.demo@serumah.app'),
    makeUser(memberIds.a, 'demo.a@serumah.app'),
    makeUser(memberIds.b, 'demo.b@serumah.app'),
  ];
  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { passwordHash: DEMO_PASSWORD_HASH },
      create: user,
    });
  }

  const rumah = await prisma.rumah.upsert({
    where: { inviteCode: DEMO_INVITE },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-0000000d0000',
      nama: DEMO_RUMAH,
      alamat: 'Jl. Demo No. 1',
      biayaKos: 1_500_000,
      biayaWifi: 200_000,
      biayaListrikWajib: 250_000,
      nominalDenda: 50_000,
      rekeningBank: 'BCA',
      rekeningNomor: '9999999999',
      rekeningNama: 'PJ Demo',
      inviteCode: DEMO_INVITE,
      createdById: pjId,
    },
  });

  const anggotaData = [
    { id: pjId, nama: 'PJ Demo', role: 'admin' },
    { id: memberIds.a, nama: 'Demo A', role: 'anggota' },
    { id: memberIds.b, nama: 'Demo B', role: 'anggota' },
  ];
  for (const a of anggotaData) {
    await prisma.anggota.upsert({
      where: { id: a.id },
      update: { rumahId: rumah.id, role: a.role },
      create: { id: a.id, rumahId: rumah.id, nama: a.nama, role: a.role },
    });
  }

  // Rooms + jenis piket.
  for (const room of ROOMS) {
    await prisma.ruangan.upsert({
      where: { id: room.id },
      update: { rumahId: rumah.id, nama: room.nama, urutan: room.urutan },
      create: {
        id: room.id,
        rumahId: rumah.id,
        nama: room.nama,
        urutan: room.urutan,
      },
    });
    for (const j of room.jenis) {
      await prisma.jenisPiket.upsert({
        where: { id: j.id },
        update: { ruanganId: room.id, nama: j.nama, isActive: true },
        create: { id: j.id, ruanganId: room.id, nama: j.nama, isActive: true },
      });
    }
  }

  // Generate hari piket weekday MINGGU INI (hari ini → Minggu): Rab 12, Jum 14.
  // Minggu depan kosong → alur "jadwal habis" teruji. Semua anggota "belum
  // pilih" weekend → test di_kos/pulang manual di app.
  const today = todayWib();
  const monday = addDays(today, -((today.getUTCDay() + 6) % 7));
  const sunday = addDays(monday, 6);

  // Clean existing demo schedule + weekend status rows (idempotent re-run).
  await prisma.jadwal.deleteMany({ where: { rumahId: rumah.id } });
  await prisma.weekendStatus.deleteMany({
    where: { anggota: { rumahId: rumah.id } },
  });

  let count = 0;
  let seq = 0;
  for (
    let cursor = today;
    cursor <= sunday;
    cursor = addDays(cursor, 1)
  ) {
    if (!PIKET_WEEKDAYS.includes(cursor.getUTCDay())) continue;
    seq += 1;
    // Round-robin bergilir PJ → A → B, dimulai dari Demo A agar bukan PJ di
    // hari pertama (hari ini Rabu 12 = Demo A, Jumat 14 = Demo B).
    const member = anggotaData[seq % anggotaData.length]!.id;
    const jadwalId = `00000000-0000-0000-0000-0000000d0a0${seq}`;
    await prisma.jadwal.create({
      data: {
        id: jadwalId,
        rumahId: rumah.id,
        tanggal: cursor,
        anggotaId: member,
        ruangan: roomNames,
      },
    });
    count += 1;
  }

  console.log({
    rumah: rumah.nama,
    inviteCode: DEMO_INVITE,
    login: 'pj.demo@serumah.app / password123',
    anggota: anggotaData.map((a) => `${a.nama} (${a.role})`),
    hariIni: today.toISOString().slice(0, 10),
    jadwalWeekday: count,
    catatan:
      'Jadwal weekday minggu ini (Rab 12 + Jum 14) — minggu depan kosong. Test: di_kos/pulang minggu ini, empty state minggu depan.',
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
