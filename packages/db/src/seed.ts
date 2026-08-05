import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { prisma } from './client';
import type { User } from '../generated/client';

const DEMO_RUMAH = 'Kos Mawar';

// Deterministic UUIDs so the seed is idempotent per run
const adminId = '00000000-0000-0000-0000-000000000001';
const memberIds = [
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
];

function makeUser(id: string, email: string): User {
  return { id, email, passwordHash: 'demo-placeholder-bcrypt-hash' } as User;
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
      update: {},
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
    { id: adminId, nama: 'Admin Mawar', role: 'admin', kamar: 'K1' },
    { id: memberIds[0]!, nama: 'Andi', role: 'anggota', kamar: 'K2' },
    { id: memberIds[1]!, nama: 'Budi', role: 'anggota', kamar: 'K3' },
    { id: memberIds[2]!, nama: 'Cici', role: 'anggota', kamar: 'K4' },
  ];

  for (const a of anggotaData) {
    await prisma.anggota.upsert({
      where: { id: a.id },
      update: { rumahId: rumah.id, role: a.role, kamar: a.kamar },
      create: { id: a.id, rumahId: rumah.id, nama: a.nama, role: a.role, kamar: a.kamar },
    });
  }

  const ruangan = await prisma.ruangan.create({
    data: {
      id: '00000000-0000-0000-0000-00000000000b',
      rumahId: rumah.id,
      nama: 'Ruang Tamu',
      urutan: 1,
      jenisPiket: {
        create: [
          { id: '00000000-0000-0000-0000-00000000000c', nama: 'Sapu' },
          { id: '00000000-0000-0000-0000-00000000000d', nama: 'Pel' },
          { id: '00000000-0000-0000-0000-00000000000e', nama: 'Rapikan sofa' },
        ],
      },
    },
  });

  console.log({
    rumah: rumah.nama,
    anggota: anggotaData.map((a) => a.nama),
    ruangan: ruangan.nama,
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
