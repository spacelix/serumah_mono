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
import { NotificationsService } from '../notifications/notifications.service';
import { CacheService } from '../redis/cache.service';

@Injectable()
export class GalonService {
  private readonly logger = new Logger(GalonService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RumahScopeService,
    private readonly cache: CacheService,
    private readonly notifications: NotificationsService,
  ) {}

  async current(payload: CurrentUserPayload) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    return this.currentFromAnggota(anggota);
  }

  /** Read the current galon turn for a known anggota (shared by dashboard). */
  async currentFromAnggota(anggota: { id: string; rumahId: string | null }) {
    if (!anggota.rumahId) {
      return { giliran: null, namaAnggota: null, isMine: false };
    }

    const giliran = await this.prisma.giliranGalon.findFirst({
      where: { rumahId: anggota.rumahId, status: 'menunggu' },
      orderBy: { periodeMulai: 'asc' },
      include: { anggota: { select: { id: true, nama: true } } },
    });

    if (!giliran) {
      // No active turn — seed/rotate from members round-robin.
      await this.ensureTurn(anggota.rumahId);
    }

    const active = await this.prisma.giliranGalon.findFirst({
      where: { rumahId: anggota.rumahId, status: 'menunggu' },
      orderBy: { periodeMulai: 'asc' },
      include: { anggota: { select: { id: true, nama: true } } },
    });

    return {
      giliran: active
        ? {
            id: active.id,
            periodeMulai: active.periodeMulai,
            status: active.status,
          }
        : null,
      namaAnggota: active?.anggota.nama ?? null,
      isMine: active?.anggota.id === anggota.id,
    };
  }

  async confirm(payload: CurrentUserPayload, giliranId: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }

    const giliran = await this.prisma.giliranGalon.findFirst({
      where: { id: giliranId, rumahId: anggota.rumahId },
    });
    if (!giliran) throw new NotFoundException('Giliran galon tidak ditemukan.');
    if (giliran.status !== 'menunggu') {
      throw new ConflictException('Giliran galon sudah selesai.');
    }

    // Confirm carried by any member (no amount, buyer bears cost). Rotate.
    const next = await this.prisma.$transaction(async (tx) => {
      await tx.giliranGalon.update({
        where: { id: giliran.id },
        data: { status: 'sudah_dibeli', confirmedAt: new Date() },
      });
      return this.rotateGalon(tx, anggota.rumahId!, giliran.id);
    });

    this.logger.log(
      `[GalonService] Giliran ${giliran.id} selesai, next ${next.id}`,
    );
    const [buyer, nextMember] = await Promise.all([
      this.prisma.anggota.findUnique({
        where: { id: giliran.anggotaId },
        select: { nama: true },
      }),
      this.prisma.anggota.findUnique({
        where: { id: next.anggotaId },
        select: { id: true, nama: true },
      }),
    ]);
    await this.notifications.notifyGalonBought(
      anggota.rumahId!,
      buyer?.nama ?? 'Anggota',
      nextMember?.nama ?? null,
    );
    await this.notifications.notifyGalonNudge(nextMember?.id ?? next.anggotaId);
    await this.cache.invalidateScope(`dashboard:${anggota.rumahId}`);
    return { next };
  }

  /** Nudge the member whose galon turn is active (bell button on Beranda). */
  async nudge(payload: CurrentUserPayload) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    const giliran = await this.prisma.giliranGalon.findFirst({
      where: { rumahId: anggota.rumahId, status: 'menunggu' },
      orderBy: { periodeMulai: 'asc' },
    });
    if (!giliran) return { ok: false };
    await this.notifications.notifyGalonNudge(giliran.anggotaId);
    return { ok: true };
  }

  private async ensureTurn(rumahId: string) {
    const members = await this.prisma.anggota.findMany({
      where: { rumahId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (members.length === 0) return;

    const lastConfirmed = await this.prisma.giliranGalon.findFirst({
      where: { rumahId, status: 'sudah_dibeli' },
      orderBy: { confirmedAt: 'desc' },
      select: { anggotaId: true },
    });
    const lastIdx = lastConfirmed
      ? members.findIndex((m) => m.id === lastConfirmed.anggotaId)
      : -1;
    const nextMember = members[(lastIdx + 1) % members.length];

    const existing = await this.prisma.giliranGalon.findFirst({
      where: { rumahId, anggotaId: nextMember.id, status: 'menunggu' },
    });
    if (existing) return existing;

    return this.prisma.giliranGalon.create({
      data: {
        rumahId,
        anggotaId: nextMember.id,
        periodeMulai: new Date(),
        status: 'menunggu',
      },
    });
  }

  /** Pick the next member after the recently-confirmed giliran and open a turn. */
  private async rotateGalon(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    rumahId: string,
    justConfirmedId: string,
  ) {
    const members = await tx.anggota.findMany({
      where: { rumahId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (members.length === 0) {
      throw new BadRequestException('Kos tidak memiliki anggota.');
    }
    const lastConfirmed = await tx.giliranGalon.findFirst({
      where: { id: justConfirmedId },
      select: { anggotaId: true },
    });
    const lastIdx = members.findIndex((m) => m.id === lastConfirmed?.anggotaId);
    const nextMember = members[(lastIdx + 1) % members.length];
    if (!nextMember) {
      throw new BadRequestException(
        'Tidak dapat menentukan giliran berikutnya.',
      );
    }

    const existing = await tx.giliranGalon.findFirst({
      where: { rumahId, anggotaId: nextMember.id, status: 'menunggu' },
    });
    if (existing) return existing;

    return tx.giliranGalon.create({
      data: {
        rumahId,
        anggotaId: nextMember.id,
        periodeMulai: new Date(),
        status: 'menunggu',
      },
    });
  }
}
