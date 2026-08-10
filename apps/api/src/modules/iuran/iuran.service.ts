import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@serumah/db/prisma';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RumahScopeService } from '../../common/services/rumah-scope.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  EnsureBulanDto,
  PelunasanDto,
  UploadBuktiTotalDto,
} from './dto/iuran.dto';
import { computeListrikAdjustment } from './iuran.math';

type Kategori = 'kos' | 'wifi' | 'listrik_wajib';

// Asia/Jakarta is UTC+7, no DST. `bulan` is stored as `@db.Date`, which Prisma
// persists from the UTC components of the JS Date — so all month math uses
// UTC-midnight dates and resolves "now" by shifting +7h first (same rule as
// the schedule/dashboard services).
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

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
  buyerMap: Map<string, number>;
  nonBuyerMap: Map<string, number>;
}

@Injectable()
export class IuranService {
  private readonly logger = new Logger(IuranService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RumahScopeService,
    private readonly notifications: NotificationsService,
  ) { }

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

  private prevMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  }

  private bulanIndex(bulan: Date): number {
    const epoch = new Date(Date.UTC(2024, 0, 1));
    return (
      (bulan.getUTCFullYear() - epoch.getUTCFullYear()) * 12 +
      (bulan.getUTCMonth() - epoch.getUTCMonth())
    );
  }

  async list(payload: CurrentUserPayload, bulan?: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      return { iuranList: [], pelunasan: [], rumah: null };
    }

    const month = bulan
      ? this.monthFromString(bulan)
      : this.firstOfMonth(new Date());
    await this.ensureBulan(anggota.rumahId, month);

    const iuran = await this.prisma.iuranBulanan.findMany({
      where: { anggota: { rumahId: anggota.rumahId }, bulan: month },
      include: {
        anggota: { select: { id: true, nama: true } },
        reviewer: { select: { id: true, nama: true } },
      },
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
      iuranList: iuran.map((i) => ({
        id: i.id,
        anggota: i.anggota,
        bulan: i.bulan,
        kategori: i.kategori,
        label: i.label,
        nominal: i.nominal,
        status: i.status,
        reviewerId: i.reviewerId,
        reviewerNama: i.reviewer?.nama ?? null,
        buktiBayar: i.buktiBayar,
        createdAt: i.createdAt,
      })),
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

  /** Public wrapper for cron (iuran next-month generation on last day of month). */
  async ensureBulanForRumah(rumahId: string, month: Date) {
    return this.ensureBulan(rumahId, month);
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
    const adjustment = await this.computeAdjustment(rumahId, month);

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

    // Assigned reviewer (locked 2026-08-10): member → PJ; PJ → round-robin
    // non-PJ member. PJ's own payment is NO LONGER auto-lunas — it must be
    // confirmed by another member (no self-confirmation).
    const reviewerId = await this.scope.assignPaymentReviewer(
      anggota.rumahId,
      anggota.id,
      await this.prisma.iuranBulanan.count({
        where: { anggotaId: anggota.id },
      }),
    );

    await this.prisma.iuranBulanan.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { status: 'menunggu_konfirmasi', reviewerId, buktiBayar: dto.buktiUrl },
    });

    this.logger.log(
      `[IuranService] ${anggota.nama} bukti ${month.toISOString()} → menunggu_konfirmasi (reviewer ${reviewerId})`,
    );
    await this.notifications.notifyPaymentReviewer(reviewerId, 'iuran');
    return { status: 'menunggu_konfirmasi', count: pending.length, reviewerId };
  }

  async confirmLunas(payload: CurrentUserPayload, iuranId: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    const iuran = await this.prisma.iuranBulanan.findUnique({
      where: { id: iuranId },
      include: { anggota: true },
    });
    if (!iuran || iuran.anggota.rumahId !== anggota.rumahId) {
      throw new NotFoundException('Iuran tidak ditemukan.');
    }
    if (iuran.status !== 'menunggu_konfirmasi') {
      throw new ConflictException('Iuran tidak menunggu konfirmasi.');
    }
    // Only the assigned reviewer may confirm (member → PJ, PJ → round-robin member).
    if (iuran.reviewerId !== anggota.id) {
      throw new ForbiddenException(
        'Bukan giliran Anda untuk memverifikasi pembayaran ini.',
      );
    }
    if (iuran.anggotaId === anggota.id) {
      throw new ForbiddenException(
        'Anda tidak dapat memverifikasi pembayaran sendiri.',
      );
    }

    await this.prisma.iuranBulanan.update({
      where: { id: iuran.id },
      data: { status: 'lunas' },
    });
    this.logger.log(`[IuranService] Iuran ${iuran.id} lunas (${anggota.nama})`);
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

  /** Loads last month's electricity records and delegates to pure math. */
  private async computeAdjustment(
    rumahId: string,
    month: Date,
  ): Promise<ListrikAdjustment> {
    const prev = this.prevMonth(month);
    const [records, members] = await Promise.all([
      this.prisma.pembayaranListrik.findMany({
        where: { rumahId, bulan: prev },
        select: { anggotaId: true, nominal: true },
      }),
      this.prisma.anggota.findMany({
        where: { rumahId },
        select: { id: true },
      }),
    ]);

    const result = computeListrikAdjustment({ records, members });
    return {
      total: result.baseDelta,
      buyerMap: result.buyerMap,
      nonBuyerMap: result.nonBuyerMap,
    };
  }

  private async requireReviewer(payload: CurrentUserPayload) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    return this.scope.requirePj(payload.userId, anggota.rumahId);
  }
}
