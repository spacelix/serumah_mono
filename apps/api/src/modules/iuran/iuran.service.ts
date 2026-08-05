import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@serumah/db/prisma';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RumahScopeService } from '../../common/services/rumah-scope.service';
import {
  EnsureBulanDto,
  PelunasanDto,
  UploadBuktiTotalDto,
} from './dto/iuran.dto';

type Kategori = 'kos' | 'wifi' | 'listrik_wajib';

const KATEGORI: {
  key: Kategori;
  label: string;
  amount: (r: {
    biayaKos: number;
    biayaWifi: number;
    biayaListrikWajib: number;
  }) => number;
}[] = [
  { key: 'kos', label: 'Sewa', amount: (r) => r.biayaKos },
  { key: 'wifi', label: 'WiFi', amount: (r) => r.biayaWifi },
  {
    key: 'listrik_wajib',
    label: 'Listrik Wajib',
    amount: (r) => r.biayaListrikWajib,
  },
];

interface ListrikAdjustment {
  total: number;
  buyerMap: Map<string, number>; // buyer → credit (nominal − share)
  nonBuyerMap: Map<string, number>; // non-buyer → +share per record
}

@Injectable()
export class IuranService {
  private readonly logger = new Logger(IuranService.name);

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

  private prevMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() - 1, 1);
  }

  private bulanIndex(bulan: Date): number {
    const epoch = new Date(2024, 0, 1);
    return (
      (bulan.getFullYear() - epoch.getFullYear()) * 12 +
      (bulan.getMonth() - epoch.getMonth())
    );
  }

  async list(payload: CurrentUserPayload, bulan?: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) return { iuran: [], pelunasan: [], rumah: null };

    const month = bulan
      ? this.monthFromString(bulan)
      : this.firstOfMonth(new Date());
    await this.ensureBulan(anggota.rumahId, month);

    const iuran = await this.prisma.iuranBulanan.findMany({
      where: { anggota: { rumahId: anggota.rumahId }, bulan: month },
      include: { anggota: { select: { id: true, nama: true, kamar: true } } },
      orderBy: { kategori: 'asc' },
    });

    const pelunasan = await this.prisma.pelunasanBulanan.findMany({
      where: { rumahId: anggota.rumahId, bulan: month },
    });

    const rumah = await this.prisma.rumah.findUnique({
      where: { id: anggota.rumahId },
      select: {
        biayaKos: true,
        biayaWifi: true,
        biayaListrikWajib: true,
        rekeningBank: true,
        rekeningNomor: true,
        rekeningNama: true,
      },
    });

    return {
      iuran,
      pelunasan,
      rumah: {
        totalPerBulan:
          (rumah?.biayaKos ?? 0) +
          (rumah?.biayaWifi ?? 0) +
          (rumah?.biayaListrikWajib ?? 0),
        rekening: {
          bank: rumah?.rekeningBank ?? null,
          nomor: rumah?.rekeningNomor ?? null,
          nama: rumah?.rekeningNama ?? null,
        },
      },
    };
  }

  async ensureBulanApi(payload: CurrentUserPayload, dto: EnsureBulanDto) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    const month = this.monthFromString(dto.bulan);
    return this.ensureBulan(anggota.rumahId, month);
  }

  /** Idempotent: create/repair iuran for the month; recompute on-demand. */
  private async ensureBulan(rumahId: string, month: Date) {
    const rumah = await this.prisma.rumah.findUnique({
      where: { id: rumahId },
    });
    if (!rumah) throw new NotFoundException('Kos tidak ditemukan.');

    const members = await this.prisma.anggota.findMany({
      where: { rumahId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (members.length === 0) return { created: 0, updated: 0 };

    // Extra electricity bought last month adjusts this month's listrik_wajib.
    const adjustment = await this.computeListrikAdjustment(
      rumahId,
      this.prevMonth(month),
    );

    let created = 0;
    let updated = 0;

    for (const kategori of KATEGORI) {
      const base = kategori.amount(rumah);
      const listrikDelta =
        kategori.key === 'listrik_wajib' ? adjustment.total : 0;
      const amounts = this.splitTotal(
        base + listrikDelta,
        members.length,
        month,
      );

      for (let i = 0; i < members.length; i += 1) {
        const member = members[i];
        let nominal = amounts[i];

        if (kategori.key === 'listrik_wajib') {
          const credit = adjustment.buyerMap.get(member.id) ?? 0;
          const surcharge = adjustment.nonBuyerMap.get(member.id) ?? 0;
          nominal = Math.max(0, nominal + surcharge - credit);
        }

        const existing = await this.prisma.iuranBulanan.findUnique({
          where: {
            anggotaId_bulan_kategori: {
              anggotaId: member.id,
              bulan: month,
              kategori: kategori.key,
            },
          },
        });

        if (existing) {
          // Patch nominal only while unpaid.
          if (
            existing.status === 'belum_bayar' &&
            existing.nominal !== nominal
          ) {
            await this.prisma.iuranBulanan.update({
              where: { id: existing.id },
              data: { nominal },
            });
            updated += 1;
          }
        } else {
          await this.prisma.iuranBulanan.create({
            data: {
              anggotaId: member.id,
              bulan: month,
              kategori: kategori.key,
              label: kategori.label,
              nominal,
            },
          });
          created += 1;
        }
      }
    }

    return { created, updated };
  }

  /** Split total across n: floor each, remainder rotated by month index. */
  private splitTotal(
    total: number,
    memberCount: number,
    month: Date,
  ): number[] {
    const result = new Array<number>(memberCount).fill(
      Math.floor(total / memberCount),
    );
    for (let i = 0; i < total % memberCount; i += 1) {
      const idx = (this.bulanIndex(month) + i) % memberCount;
      result[idx] = (result[idx] ?? 0) + 1;
    }
    return result;
  }

  async uploadBuktiTotal(
    payload: CurrentUserPayload,
    dto: UploadBuktiTotalDto,
  ) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    const month = this.monthFromString(dto.bulan);
    await this.ensureBulan(anggota.rumahId, month);

    const pending = await this.prisma.iuranBulanan.findMany({
      where: { anggotaId: anggota.id, bulan: month, status: 'belum_bayar' },
    });
    if (pending.length === 0) {
      throw new ConflictException(
        'Tidak ada iuran yang perlu dibayar pada bulan tersebut.',
      );
    }

    const isPj = await this.scope.isPj(anggota.id, anggota.rumahId);
    const nextStatus = isPj ? 'lunas' : 'menunggu_konfirmasi';

    await this.prisma.iuranBulanan.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { status: nextStatus, buktiBayar: dto.buktiUrl },
    });

    this.logger.log(
      `[IuranService] ${anggota.nama} bukti ${month.toISOString()} → ${nextStatus}`,
    );
    return { status: nextStatus, count: pending.length };
  }

  async confirmLunas(payload: CurrentUserPayload, iuranId: string) {
    const pj = await this.requireReviewer(payload);
    const iuran = await this.prisma.iuranBulanan.findUnique({
      where: { id: iuranId },
      include: { anggota: true },
    });
    if (!iuran || iuran.anggota.rumahId !== pj.rumahId) {
      throw new NotFoundException('Iuran tidak ditemukan.');
    }

    await this.prisma.iuranBulanan.update({
      where: { id: iuran.id },
      data: { status: 'lunas' },
    });
    this.logger.log(`[IuranService] Iuran ${iuran.id} lunas (${pj.nama})`);
    return { iuran: { id: iuran.id, status: 'lunas' } };
  }

  async pelunasan(payload: CurrentUserPayload, dto: PelunasanDto) {
    const pj = await this.requireReviewer(payload);
    const month = this.monthFromString(dto.bulan);

    const pelunasan = await this.prisma.pelunasanBulanan.upsert({
      where: {
        rumahId_bulan_kategori: {
          rumahId: pj.rumahId!,
          bulan: month,
          kategori: dto.kategori,
        },
      },
      update: { buktiLunas: dto.buktiLunas, createdById: pj.id },
      create: {
        rumahId: pj.rumahId!,
        bulan: month,
        kategori: dto.kategori,
        buktiLunas: dto.buktiLunas,
        createdById: pj.id,
      },
    });
    this.logger.log(`[IuranService] Pelunasan ${pelunasan.id}`);
    return { pelunasan };
  }

  /** Next-month effects of extra electricity bought in `month`. */
  private async computeListrikAdjustment(
    rumahId: string,
    month: Date,
  ): Promise<ListrikAdjustment> {
    const records = await this.prisma.pembayaranListrik.findMany({
      where: { rumahId, bulan: month },
    });
    const members = await this.prisma.anggota.findMany({
      where: { rumahId },
      select: { id: true },
    });
    const n = members.length;

    const buyerMap = new Map<string, number>();
    const nonBuyerMap = new Map<string, number>();
    let total = 0;

    for (const rec of records) {
      total += rec.nominal;
      if (n === 0) continue;
      const share = Math.floor(rec.nominal / n);
      buyerMap.set(
        rec.anggotaId,
        (buyerMap.get(rec.anggotaId) ?? 0) + (rec.nominal - share),
      );
    }

    const buyerSet = new Set(records.map((r) => r.anggotaId));
    for (const member of members) {
      if (buyerSet.has(member.id)) continue;
      let shareSum = 0;
      for (const rec of records) {
        shareSum += Math.floor(rec.nominal / n);
      }
      if (shareSum > 0) nonBuyerMap.set(member.id, shareSum);
    }

    return { total, buyerMap, nonBuyerMap };
  }

  private async requireReviewer(payload: CurrentUserPayload) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    return this.scope.requirePj(payload.userId, anggota.rumahId);
  }
}
