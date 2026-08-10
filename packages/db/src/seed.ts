import 'dotenv/config';
import { prisma } from './client';
import type { User } from '../generated/client/index.js';

const DEMO_RUMAH = 'Kos Mawar';

// Deterministic UUIDs so the seed is idempotent per run
const adminId = '00000000-0000-0000-0000-000000000001';
const memberIds = [
  '00000000-0000-0000-0000-000000000002', // Andi
  '00000000-0000-0000-0000-000000000003', // Budi
  '00000000-0000-0000-0000-000000000004', // Cici
];

const ROOMS = [
  {
    id: '00000000-0000-0000-0000-00000000000b',
    nama: 'Ruang Tamu',
    urutan: 1,
    jenis: [
      { id: '00000000-0000-0000-0000-00000000000c', nama: 'Sapu' },
      { id: '00000000-0000-0000-0000-00000000000d', nama: 'Pel' },
      { id: '00000000-0000-0000-0000-00000000000e', nama: 'Rapikan sofa' },
    ],
  },
  {
    id: '00000000-0000-0000-0000-00000000001b',
    nama: 'Dapur',
    urutan: 2,
    jenis: [
      { id: '00000000-0000-0000-0000-00000000001c', nama: 'Sapu' },
      { id: '00000000-0000-0000-0000-00000000001d', nama: 'Cuci piring' },
      { id: '00000000-0000-0000-0000-00000000001e', nama: 'Pel' },
    ],
  },
  {
    id: '00000000-0000-0000-0000-00000000002b',
    nama: 'Kamar Mandi',
    urutan: 3,
    jenis: [
      { id: '00000000-0000-0000-0000-00000000002c', nama: 'Bersihin kloset' },
      { id: '00000000-0000-0000-0000-00000000002d', nama: 'Sapu' },
      { id: '00000000-0000-0000-0000-00000000002e', nama: 'Pel' },
    ],
  },
];

// Precomputed bcrypt hash for "password123" (rounds = 10) — constant so the
// seed stays idempotent and demo login works end-to-end.
const DEMO_PASSWORD_HASH =
  '$2b$10$nxMD2bdAaEOXsUaJ5X3bzeg0E33p39JunhF9w6sgwCl6cfBCac2.a';

// UTC-midnight date helpers — `@db.Date` columns are persisted from UTC
// components (same WIB/UTC rule as the services).
function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}
function stamp(y: number, m: number, d: number, hour: number): Date {
  return new Date(Date.UTC(y, m - 1, d, hour, 0, 0));
}

const roomNames = ROOMS.map((r) => r.nama);

// ── HISTORY (past weeks, resolved) ────────────────────────────────────
// jadwalId → { anggota, tanggal, status, submittedHour, photos }
const HISTORY: {
  jadwalId: string;
  submissionId: string;
  approvalId: string;
  anggotaId: string;
  tanggal: Date;
  status: 'approved' | 'rejected' | 'menunggu';
  submittedHour: number;
}[] = [
  {
    jadwalId: '00000000-0000-0000-0000-0000000000a1',
    submissionId: '00000000-0000-0000-0000-0000000000b1',
    approvalId: '00000000-0000-0000-0000-0000000000c1',
    anggotaId: memberIds[0]!,
    tanggal: utc(2026, 7, 27), // Senin
    status: 'approved',
    submittedHour: 9,
  },
  {
    jadwalId: '00000000-0000-0000-0000-0000000000a2',
    submissionId: '00000000-0000-0000-0000-0000000000b2',
    approvalId: '00000000-0000-0000-0000-0000000000c2',
    anggotaId: memberIds[1]!,
    tanggal: utc(2026, 7, 29), // Rabu
    status: 'approved',
    submittedHour: 10,
  },
  {
    jadwalId: '00000000-0000-0000-0000-0000000000a3',
    submissionId: '00000000-0000-0000-0000-0000000000b3',
    approvalId: '00000000-0000-0000-0000-0000000000c3',
    anggotaId: memberIds[2]!,
    tanggal: utc(2026, 7, 31), // Jumat
    status: 'rejected',
    submittedHour: 11,
  },
  {
    jadwalId: '00000000-0000-0000-0000-0000000000a4',
    submissionId: '00000000-0000-0000-0000-0000000000b4',
    approvalId: '00000000-0000-0000-0000-0000000000c4',
    anggotaId: memberIds[0]!,
    tanggal: utc(2026, 8, 3), // Senin
    status: 'approved',
    submittedHour: 9,
  },
  {
    jadwalId: '00000000-0000-0000-0000-0000000000a5',
    submissionId: '00000000-0000-0000-0000-0000000000b5',
    approvalId: '00000000-0000-0000-0000-0000000000c5',
    anggotaId: memberIds[1]!,
    tanggal: utc(2026, 8, 5), // Rabu
    status: 'approved',
    submittedHour: 10,
  },
  {
    jadwalId: '00000000-0000-0000-0000-0000000000a6',
    submissionId: '00000000-0000-0000-0000-0000000000b6',
    approvalId: '00000000-0000-0000-0000-0000000000c6',
    anggotaId: memberIds[2]!,
    tanggal: utc(2026, 8, 7), // Jumat
    status: 'approved',
    submittedHour: 11,
  },
];

// ── TODAY (Minggu 9 Agu 2026) — Admin Mawar, weekend di_kos ───────────
const TODAY = {
  jadwalId: '00000000-0000-0000-0000-0000000000a7',
  anggotaId: adminId,
  tanggal: utc(2026, 8, 9), // Minggu
};

// ── SWAP SEED (deterministic) ─────────────────────────────────────────
// Swap hanya untuk 1 minggu berjalan (Sen–Min, hanya hari ≥ hari ini).
// Hari ini = Minggu 9 Agu 2026, jadi request di-seed pada hari piket
// minggu berjalan (Sen 3 / Rab 5 / Jum 7 Agu) yang sudah lewat — muncul
// sebagai histori/request masuk, bukan di form (form cuma hari ≥ hari ini).
const SWAPS: {
  id: string;
  dariAnggotaId: string;
  keAnggotaId: string;
  tanggal: Date;
  tanggalKe: Date;
  status: string;
  createdAt: Date;
  resolvedAt?: Date;
}[] = [
  {
    id: '00000000-0000-0000-0000-0000000000e1',
    dariAnggotaId: memberIds[0]!, // Andi
    keAnggotaId: memberIds[1]!, // Budi
    tanggal: utc(2026, 8, 3), // Senin
    tanggalKe: utc(2026, 8, 5), // Rabu (Budi)
    status: 'diajukan',
    createdAt: stamp(2026, 8, 3, 8),
  },
  {
    id: '00000000-0000-0000-0000-0000000000e2',
    dariAnggotaId: memberIds[2]!, // Cici
    keAnggotaId: memberIds[0]!, // Andi
    tanggal: utc(2026, 8, 7), // Jumat
    tanggalKe: utc(2026, 8, 3), // Senin (Andi)
    status: 'diajukan',
    createdAt: stamp(2026, 8, 7, 9),
  },
  {
    id: '00000000-0000-0000-0000-0000000000e3',
    dariAnggotaId: memberIds[1]!, // Budi
    keAnggotaId: memberIds[0]!, // Andi
    tanggal: utc(2026, 8, 5), // Rabu
    tanggalKe: utc(2026, 8, 3), // Senin (Andi)
    status: 'diterima',
    createdAt: stamp(2026, 8, 4, 14),
    resolvedAt: stamp(2026, 8, 5, 9),
  },
  {
    id: '00000000-0000-0000-0000-0000000000e4',
    dariAnggotaId: memberIds[0]!, // Andi
    keAnggotaId: memberIds[2]!, // Cici
    tanggal: utc(2026, 8, 3), // Senin
    tanggalKe: utc(2026, 8, 7), // Jumat (Cici)
    status: 'ditolak',
    createdAt: stamp(2026, 8, 5, 10),
    resolvedAt: stamp(2026, 8, 6, 12),
  },
];

function makeUser(id: string, email: string): User {
  return { id, email, passwordHash: DEMO_PASSWORD_HASH } as User;
}

async function main() {
  const users = [
    makeUser(adminId, 'admin@demo.com'),
    makeUser(memberIds[0]!, 'andi@demo.com'),
    makeUser(memberIds[1]!, 'budi@demo.com'),
    makeUser(memberIds[2]!, 'cici@demo.com'),
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { passwordHash: DEMO_PASSWORD_HASH },
      create: user,
    });
  }

  const rumah = await prisma.rumah.upsert({
    where: { inviteCode: '123456' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-00000000000a',
      nama: DEMO_RUMAH,
      alamat: 'Jl. Melati No. 12, Bandung',
      biayaKos: 1_500_000,
      biayaWifi: 200_000,
      biayaListrikWajib: 250_000,
      nominalDenda: 50_000,
      rekeningBank: 'BCA',
      rekeningNomor: '1234567890',
      rekeningNama: 'Pengelola Kos Mawar',
      inviteCode: '123456',
      createdById: adminId,
    },
  });

  const anggotaData = [
    { id: adminId, nama: 'Admin Mawar', role: 'admin' },
    { id: memberIds[0]!, nama: 'Andi', role: 'anggota' },
    { id: memberIds[1]!, nama: 'Budi', role: 'anggota' },
    { id: memberIds[2]!, nama: 'Cici', role: 'anggota' },
  ];

  for (const a of anggotaData) {
    await prisma.anggota.upsert({
      where: { id: a.id },
      update: { rumahId: rumah.id, role: a.role },
      create: {
        id: a.id,
        rumahId: rumah.id,
        nama: a.nama,
        role: a.role,
      },
    });
  }

  // Rooms + jenis piket (3 rooms matching Serumah.html).
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
        create: {
          id: j.id,
          ruanganId: room.id,
          nama: j.nama,
          isActive: true,
        },
      });
    }
  }

  // Weekend status — current week (MingguMulai Senin 3 Agu): Admin Mawar
  // piket Minggu (di_kos), anggota lain pulang.
  const currentWeek = utc(2026, 8, 3);
  const weekendRows = [
    { anggotaId: adminId, hari: 'sabtu', status: 'pulang' },
    { anggotaId: adminId, hari: 'minggu', status: 'di_kos' },
    { anggotaId: memberIds[0]!, hari: 'sabtu', status: 'pulang' },
    { anggotaId: memberIds[0]!, hari: 'minggu', status: 'pulang' },
    { anggotaId: memberIds[1]!, hari: 'sabtu', status: 'pulang' },
    { anggotaId: memberIds[1]!, hari: 'minggu', status: 'pulang' },
    { anggotaId: memberIds[2]!, hari: 'sabtu', status: 'pulang' },
    { anggotaId: memberIds[2]!, hari: 'minggu', status: 'pulang' },
  ];
  for (const w of weekendRows) {
    await prisma.weekendStatus.upsert({
      where: {
        anggotaId_mingguMulai_hari: {
          anggotaId: w.anggotaId,
          mingguMulai: currentWeek,
          hari: w.hari,
        },
      },
      update: { status: w.status },
      create: {
        anggotaId: w.anggotaId,
        mingguMulai: currentWeek,
        hari: w.hari,
        status: w.status,
      },
    });
  }

  // History jadwal + submissions + approvals (+ 1 denda for the rejected).
  let dendaCount = 0;
  for (const h of HISTORY) {
    await prisma.jadwal.upsert({
      where: { id: h.jadwalId },
      update: {
        rumahId: rumah.id,
        tanggal: h.tanggal,
        anggotaId: h.anggotaId,
        ruangan: roomNames,
      },
      create: {
        id: h.jadwalId,
        rumahId: rumah.id,
        tanggal: h.tanggal,
        anggotaId: h.anggotaId,
        ruangan: roomNames,
      },
    });

    await prisma.piketSubmission.upsert({
      where: { id: h.submissionId },
      update: {
        status: h.status,
        submittedAt: stamp(
          h.tanggal.getUTCFullYear(),
          h.tanggal.getUTCMonth() + 1,
          h.tanggal.getUTCDate(),
          h.submittedHour,
        ),
      },
      create: {
        id: h.submissionId,
        jadwalId: h.jadwalId,
        anggotaId: h.anggotaId,
        status: h.status,
        submittedAt: stamp(
          h.tanggal.getUTCFullYear(),
          h.tanggal.getUTCMonth() + 1,
          h.tanggal.getUTCDate(),
          h.submittedHour,
        ),
      },
    });

    // Proof per room.
    let proofSeq = 1;
    for (const room of ROOMS) {
      const proofId =
        `00000000-0000-0000-0000-${h.submissionId.slice(-6)}${String(proofSeq).padStart(6, '0')}`;
      proofSeq += 1;
      await prisma.ruanganProof.upsert({
        where: {
          submissionId_ruanganId: {
            submissionId: h.submissionId,
            ruanganId: room.id,
          },
        },
        update: {},
        create: {
          id: proofId,
          submissionId: h.submissionId,
          ruanganId: room.id,
          fotoBefore: `photos/${h.submissionId}/${room.id}_before_${h.tanggal.toISOString().slice(0, 10)}.jpg`,
          fotoAfter: `photos/${h.submissionId}/${room.id}_after_${h.tanggal.toISOString().slice(0, 10)}.jpg`,
          jenisSelesai: room.jenis.map((j) => j.nama),
        },
      });
    }

    // Approval row for resolved submissions; pending stays without approval.
    if (h.status !== 'menunggu') {
      await prisma.piketApproval.upsert({
        where: { id: h.approvalId },
        update: { status: h.status },
        create: {
          id: h.approvalId,
          submissionId: h.submissionId,
          status: h.status,
          reviewerId: adminId,
        },
      });
    }

    // Rejected → flat denda.
    if (h.status === 'rejected') {
      dendaCount += 1;
      const dendaId = `00000000-0000-0000-0000-0000000000d${dendaCount}`;
      await prisma.denda.upsert({
        where: { id: dendaId },
        update: {
          anggotaId: h.anggotaId,
          submissionId: h.submissionId,
          nominal: rumah.nominalDenda,
        },
        create: {
          id: dendaId,
          anggotaId: h.anggotaId,
          submissionId: h.submissionId,
          nominal: rumah.nominalDenda,
          status: 'belum_bayar',
        },
      });
    }
  }

  // Today — Admin Mawar piket Minggu (weekend di_kos). No submission yet so
  // the PJ can walk the Piket gw flow on the device.
  await prisma.jadwal.upsert({
    where: { id: TODAY.jadwalId },
    update: {
      rumahId: rumah.id,
      tanggal: TODAY.tanggal,
      anggotaId: TODAY.anggotaId,
      ruangan: roomNames,
    },
    create: {
      id: TODAY.jadwalId,
      rumahId: rumah.id,
      tanggal: TODAY.tanggal,
      anggotaId: TODAY.anggotaId,
      ruangan: roomNames,
    },
  });

  // Swap requests (incoming + history).
  for (const s of SWAPS) {
    await prisma.swapRequest.upsert({
      where: { id: s.id },
      update: {
        dariAnggotaId: s.dariAnggotaId,
        keAnggotaId: s.keAnggotaId,
        tanggal: s.tanggal,
        tanggalKe: s.tanggalKe,
        status: s.status,
        createdAt: s.createdAt,
        resolvedAt: s.resolvedAt ?? null,
      },
      create: {
        id: s.id,
        dariAnggotaId: s.dariAnggotaId,
        keAnggotaId: s.keAnggotaId,
        tanggal: s.tanggal,
        tanggalKe: s.tanggalKe,
        status: s.status,
        createdAt: s.createdAt,
        resolvedAt: s.resolvedAt ?? null,
      },
    });
  }

  console.log({
    rumah: rumah.nama,
    anggota: anggotaData.map((a) => a.nama),
    ruangan: ROOMS.map((r) => r.nama),
    history: HISTORY.length,
    denda: dendaCount,
    swap: SWAPS.length,
    today: {
      tanggal: TODAY.tanggal.toISOString().slice(0, 10),
      piket: 'Admin Mawar (Minggu · di_kos)',
    },
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
