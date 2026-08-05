import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@serumah/db/prisma';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RumahScopeService } from '../../common/services/rumah-scope.service';
import { CreateListrikDto } from './dto/listrik.dto';

@Injectable()
export class ListrikService {
  private readonly logger = new Logger(ListrikService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RumahScopeService,
  ) {}

  private monthFromString(bulan: string): Date {
    const match = /^(\d{4})-(\d{2})$/.exec(bulan);
    if (!match) {
      throw new BadRequestException('Format bulan harus YYYY-MM.');
    }
    return new Date(Number(match[1]), Number(match[2]) - 1, 1);
  }

  private firstOfMonth(date: Date | string): Date {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  async list(payload: CurrentUserPayload, bulan?: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) return { records: [], anggotaCount: 0, myTotal: 0 };

    const month = bulan
      ? this.monthFromString(bulan)
      : this.firstOfMonth(new Date());

    const [records, membersOfThisMonth] = await Promise.all([
      this.prisma.pembayaranListrik.findMany({
        where: { rumahId: anggota.rumahId, bulan: month },
        include: { anggota: { select: { id: true, nama: true, kamar: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.anggota.findMany({
        where: { rumahId: anggota.rumahId },
        select: { id: true },
      }),
    ]);

    const n = membersOfThisMonth.length;
    const myTotal = records
      .filter((r) => r.anggotaId === anggota.id)
      .reduce((sum, r) => sum + r.nominal, 0);

    const totalBelanja = records.reduce((sum, r) => sum + r.nominal, 0);

    // Buyer credit applied to next month = sum(nominal − share) per own record.
    const myCredit = records
      .filter((r) => r.anggotaId === anggota.id)
      .reduce(
        (sum, r) =>
          sum + (n > 0 ? r.nominal - Math.floor(r.nominal / n) : r.nominal),
        0,
      );

    return {
      records: records.map((r) => ({
        id: r.id,
        anggota: r.anggota,
        nominal: r.nominal,
        bulan: r.bulan,
        keterangan: r.keterangan,
        buktiBayar: r.buktiBayar,
        createdAt: r.createdAt,
        share: n > 0 ? Math.floor(r.nominal / n) : 0,
      })),
      anggotaCount: n,
      totalBelanja,
      myTotal,
      myCredit,
    };
  }

  async create(payload: CurrentUserPayload, dto: CreateListrikDto) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    const month = this.monthFromString(dto.bulan);

    const record = await this.prisma.pembayaranListrik.create({
      data: {
        rumahId: anggota.rumahId,
        anggotaId: anggota.id,
        bulan: month,
        nominal: dto.nominal,
        keterangan: dto.keterangan,
        buktiBayar: dto.buktiUrl,
      },
    });

    this.logger.log(
      `[ListrikService] ${anggota.nama} membeli listrik Rp${dto.nominal}`,
    );
    return { record };
  }
}
