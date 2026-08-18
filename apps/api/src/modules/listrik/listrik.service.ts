import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@serumah/db/prisma';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RumahScopeService } from '../../common/services/rumah-scope.service';
import { CreateListrikDto } from './dto/listrik.dto';

// Asia/Jakarta is UTC+7, no DST. `bulan` is stored as `@db.Date`, which Prisma
// persists from the UTC components of the JS Date — so all month math uses
// UTC-midnight dates and resolves "now" by shifting +7h first (same rule as
// the schedule/dashboard services).
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

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
    // "2026-08" is already an explicit calendar month — build UTC-midnight so
    // the stored `@db.Date` value is 2026-08-01 regardless of server timezone.
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  }

  private firstOfMonth(date: Date | string): Date {
    // "Now" is resolved in WIB (UTC+7), then canonicalized to UTC-midnight so
    // the stored `@db.Date` matches what a WIB user sees as "this month".
    const d = new Date(date);
    const wib = new Date(d.getTime() + WIB_OFFSET_MS);
    return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1));
  }

  async list(payload: CurrentUserPayload, bulan?: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      return {
        records: [],
        nameMap: {},
        total: 0,
        myBought: 0,
        nAnggota: 0,
        myCredit: 0,
      };
    }

    const month = bulan
      ? this.monthFromString(bulan)
      : this.firstOfMonth(new Date());

    const [records, allMembers] = await Promise.all([
      this.prisma.pembayaranListrik.findMany({
        where: { rumahId: anggota.rumahId, bulan: month },
        include: { anggota: { select: { id: true, nama: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.anggota.findMany({
        where: { rumahId: anggota.rumahId },
        select: { id: true, nama: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const n = allMembers.length;
    const nameMap = Object.fromEntries(allMembers.map((m) => [m.id, m.nama]));
    // Deterministic member order for distributing the rounding remainder.
    const memberIds = allMembers.map((m) => m.id);

    const total = records.reduce((sum, r) => sum + r.nominal, 0);
    const myBought = records
      .filter((r) => r.anggotaId === anggota.id)
      .reduce((sum, r) => sum + r.nominal, 0);

    // Even split per record: base = floor(nominal / n); the rounding remainder
    // (nominal − base·n) is spread +1 rupiah to `remainder` members, rotating
    // the start by the record index so nobody always absorbs the remainder.
    const sharesFor = (
      nominal: number,
      recordIndex: number,
    ): Record<string, number> => {
      if (n === 0) return {};
      const base = Math.floor(nominal / n);
      const remainder = nominal - base * n;
      const shares: Record<string, number> = {};
      for (let i = 0; i < n; i++) {
        const member = memberIds[(recordIndex + i) % n];
        shares[member] = base + (i < remainder ? 1 : 0);
      }
      return shares;
    };

    // Buyer's own credit toward next month = sum(nominal − own share) per record.
    let myCredit = 0;
    const recordsOut = records.map((r, index) => {
      const shares = sharesFor(r.nominal, index);
      if (r.anggotaId === anggota.id) {
        myCredit += r.nominal - (shares[r.anggotaId] ?? 0);
      }
      return {
        id: r.id,
        anggota: r.anggota,
        nominal: r.nominal,
        bulan: r.bulan,
        keterangan: r.keterangan,
        buktiBayar: r.buktiBayar,
        createdAt: r.createdAt,
        share: shares[r.anggotaId] ?? 0,
        shares,
      };
    });

    return {
      records: recordsOut,
      nameMap,
      total,
      myBought,
      nAnggota: n,
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
