import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@serumah/db/prisma';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RumahScopeService } from '../../common/services/rumah-scope.service';

// Asia/Jakarta is UTC+7, no DST. Denda `createdAt` is a timestamptz, so its
// WIB calendar month is derived by shifting +7h before reading the UTC month.
// `@db.Date` columns (jadwal.tanggal, iuran.bulan, listrik.bulan) are already
// stored as the UTC-midnight of the WIB calendar day — their UTC month matches.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

@Injectable()
export class TagihanService {
  private readonly logger = new Logger(TagihanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RumahScopeService,
  ) {}

/**
   * Distinct WIB calendar months (YYYY-MM) that have any per-month tagihan
   * data for the member's rumah — piket schedule (`jadwal.tanggal`), denda
   * (`createdAt` in WIB), iuran (`bulan`), listrik (`bulan`) and pelunasan
   * rows. Iuran and listrik months are kept **regardless of payment status**:
   * the monthly iuran record IS the bill for that month, so those months
   * belong in the filter (historical unpaid months included). Descending.
   */
  async listMonths(payload: CurrentUserPayload) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) return { months: [] };

    const [jadwal, denda, listrik, iuran, pelunasan] = await Promise.all([
      this.prisma.jadwal.findMany({
        where: { rumahId: anggota.rumahId },
        select: { tanggal: true },
      }),
      this.prisma.denda.findMany({
        where: { anggota: { rumahId: anggota.rumahId } },
        select: { createdAt: true },
      }),
      this.prisma.pembayaranListrik.findMany({
        where: { rumahId: anggota.rumahId },
        select: { bulan: true },
      }),
      this.prisma.iuranBulanan.findMany({
        where: { anggota: { rumahId: anggota.rumahId } },
        select: { bulan: true },
      }),
      this.prisma.pelunasanBulanan.findMany({
        where: { rumahId: anggota.rumahId },
        select: { bulan: true },
      }),
    ]);

    const months = new Set<string>();
    for (const row of jadwal) months.add(this.monthKey(row.tanggal));
    for (const row of denda) {
      months.add(this.monthKey(new Date(row.createdAt.getTime() + WIB_OFFSET_MS)));
    }
    for (const row of listrik) months.add(this.monthKey(row.bulan));
    for (const row of iuran) months.add(this.monthKey(row.bulan));
    for (const row of pelunasan) months.add(this.monthKey(row.bulan));

    const result = [...months].sort().reverse();
    this.logger.log(
      `[TagihanService] ${result.length} bulan dengan data untuk rumah ${anggota.rumahId}`,
    );
    return { months: result };
  }

  private monthKey(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
      2,
      '0',
    )}`;
  }
}