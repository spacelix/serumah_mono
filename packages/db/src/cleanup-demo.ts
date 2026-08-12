/**
 * CLEANUP DEMO — hapus seluruh data rumah demo (Kos Demo) beserta user-nya.
 *
 * Rumah demo (seed-demo.ts) memakai ID deterministik awalan `...0d...`:
 *   - rumah: 00000000-0000-0000-0000-0000000d0000
 *   - user/anggota: ...0d0001 (PJ), ...0d0002 (A), ...0d0003 (B)
 *
 * Schema tanpa onDelete cascade → hapus berurutan dari tabel anak ke induk.
 * Jalankan:  bun run db:cleanup:demo
 */
import 'dotenv/config';
import { prisma } from './client';

const DEMO_RUMAH_ID = '00000000-0000-0000-0000-0000000d0000';
const DEMO_USER_IDS = [
  '00000000-0000-0000-0000-0000000d0001',
  '00000000-0000-0000-0000-0000000d0002',
  '00000000-0000-0000-0000-0000000d0003',
];

async function main() {
  const rumah = await prisma.rumah.findUnique({
    where: { id: DEMO_RUMAH_ID },
  });
  if (!rumah) {
    console.log('Rumah demo tidak ditemukan — tidak ada yang dihapus.');
    return;
  }
  console.log(`Membersihkan rumah demo: ${rumah.nama} (${rumah.id})`);

  // Submissions → proofs & approvals & denda (via submission)
  const submissions = await prisma.piketSubmission.findMany({
    where: { anggotaId: { in: DEMO_USER_IDS } },
    select: { id: true },
  });
  const submissionIds = submissions.map((s) => s.id);
  await prisma.pembayaranApproval.deleteMany({
    where: { denda: { anggotaId: { in: DEMO_USER_IDS } } },
  });
  if (submissionIds.length > 0) {
    await prisma.ruanganProof.deleteMany({
      where: { submissionId: { in: submissionIds } },
    });
    await prisma.piketApproval.deleteMany({
      where: { submissionId: { in: submissionIds } },
    });
  }
  await prisma.denda.deleteMany({
    where: { anggotaId: { in: DEMO_USER_IDS } },
  });
  await prisma.piketSubmission.deleteMany({
    where: { anggotaId: { in: DEMO_USER_IDS } },
  });

  // Swap (dari/ke anggota demo)
  await prisma.swapRequest.deleteMany({
    where: {
      OR: [
        { dariAnggotaId: { in: DEMO_USER_IDS } },
        { keAnggotaId: { in: DEMO_USER_IDS } },
      ],
    },
  });

  // Iuran + listrik + galon (scoped rumah & anggota demo)
  await prisma.iuranBulanan.deleteMany({
    where: { anggotaId: { in: DEMO_USER_IDS } },
  });
  await prisma.pelunasanBulanan.deleteMany({ where: { rumahId: rumah.id } });
  await prisma.pembayaranListrik.deleteMany({
    where: {
      OR: [{ rumahId: rumah.id }, { anggotaId: { in: DEMO_USER_IDS } }],
    },
  });
  await prisma.giliranGalon.deleteMany({ where: { rumahId: rumah.id } });

  // Jadwal + weekend status
  await prisma.jadwal.deleteMany({ where: { rumahId: rumah.id } });
  await prisma.weekendStatus.deleteMany({
    where: { anggotaId: { in: DEMO_USER_IDS } },
  });

  // Ruangan & jenis piket
  const ruanganIds = (
    await prisma.ruangan.findMany({
      where: { rumahId: rumah.id },
      select: { id: true },
    })
  ).map((r) => r.id);
  await prisma.jenisPiket.deleteMany({
    where: { ruanganId: { in: ruanganIds } },
  });
  await prisma.ruangan.deleteMany({ where: { rumahId: rumah.id } });

  // Undangan + anggota + rumah
  await prisma.undanganKos.deleteMany({ where: { rumahId: rumah.id } });
  await prisma.anggota.deleteMany({ where: { rumahId: rumah.id } });

  // User demo (jangan sentuh rumah lain / user produksi)
  await prisma.user.deleteMany({ where: { id: { in: DEMO_USER_IDS } } });

  await prisma.rumah.delete({ where: { id: rumah.id } });

  console.log('Selesai — rumah demo + semua jadwal + user demo dihapus.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
