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
import { CreateSwapDto } from './dto/swap.dto';

const PIKET_WEEKDAYS = [1, 3, 5];

// Asia/Jakarta is UTC+7, no DST. `tanggal` is stored as `@db.Date`, which
// Prisma persists from UTC components — so all calendar math uses UTC-midnight
// dates and resolves "today" by shifting +7h (same rule as schedule/dashboard).
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RumahScopeService,
    private readonly notifications: NotificationsService,
  ) {}

  private toDate(date: Date | string): Date {
    const d = new Date(date);
    const wib = new Date(d.getTime() + WIB_OFFSET_MS);
    return new Date(
      Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()),
    );
  }

  private addDays(date: Date, days: number): Date {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + days,
      ),
    );
  }

  async list(payload: CurrentUserPayload) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) return { incoming: [], mine: [] };

    const [incoming, mine] = await Promise.all([
      this.prisma.swapRequest.findMany({
        where: { keAnggotaId: anggota.id, status: 'diajukan' },
        include: {
          dari: { select: { id: true, nama: true } },
          ke: { select: { id: true, nama: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.swapRequest.findMany({
        where: { dariAnggotaId: anggota.id },
        include: {
          dari: { select: { id: true, nama: true } },
          ke: { select: { id: true, nama: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { incoming, mine };
  }

  async availableDays(payload: CurrentUserPayload) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) return [];

    const today = this.toDate(new Date());
    const twoWeeksAhead = this.addDays(today, 14);

    const jadwal = await this.prisma.jadwal.findMany({
      where: {
        rumahId: anggota.rumahId,
        anggotaId: anggota.id,
        tanggal: { gte: today, lte: twoWeeksAhead },
      },
      select: { tanggal: true },
    });

    const days = jadwal
      .map((j) => j.tanggal)
      .filter((d) => PIKET_WEEKDAYS.includes(d.getUTCDay()))
      .sort((a, b) => a.getTime() - b.getTime());

    return days;
  }

  /**
   * For the swap form step 2: every other member + their scheduled piket days
   * (next 2 weeks) that can be swapped in. Mutual 2-day swap target picker.
   */
  async targetDays(payload: CurrentUserPayload) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) return [];

    const today = this.toDate(new Date());
    const twoWeeksAhead = this.addDays(today, 14);

    const [members, jadwal] = await Promise.all([
      this.prisma.anggota.findMany({
        where: { rumahId: anggota.rumahId, id: { not: anggota.id } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, nama: true },
      }),
      this.prisma.jadwal.findMany({
        where: {
          rumahId: anggota.rumahId,
          tanggal: { gte: today, lte: twoWeeksAhead },
        },
        select: { tanggal: true, anggotaId: true },
      }),
    ]);

    const daysByMember = new Map<string, Date[]>();
    for (const j of jadwal) {
      if (!PIKET_WEEKDAYS.includes(j.tanggal.getUTCDay())) continue;
      const list = daysByMember.get(j.anggotaId) ?? [];
      list.push(j.tanggal);
      daysByMember.set(j.anggotaId, list);
    }

    return members
      .map((m) => ({
        id: m.id,
        nama: m.nama,
        days: (daysByMember.get(m.id) ?? []).sort((a, b) => a.getTime() - b.getTime()),
      }))
      .filter((m) => m.days.length > 0);
  }

  async create(payload: CurrentUserPayload, dto: CreateSwapDto) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    if (dto.keAnggotaId === anggota.id) {
      throw new BadRequestException('Tidak dapat menukar dengan diri sendiri.');
    }

    const tanggalLo = this.toDate(dto.tanggal);
    const tanggalMereka = this.toDate(dto.tanggalKe);

    // Must be an already-scheduled piket day for this user.
    const jadwalLo = await this.prisma.jadwal.findFirst({
      where: { rumahId: anggota.rumahId, tanggal: tanggalLo },
    });
    if (!jadwalLo) {
      throw new BadRequestException(
        'Tidak ada jadwal piket pada tanggal tersebut.',
      );
    }
    if (jadwalLo.anggotaId !== anggota.id) {
      throw new BadRequestException(
        'Anda tidak memiliki jadwal piket pada tanggal tersebut.',
      );
    }

    const receiver = await this.prisma.anggota.findUnique({
      where: { id: dto.keAnggotaId },
    });
    if (!receiver || receiver.rumahId !== anggota.rumahId) {
      throw new BadRequestException('Anggota penerima tidak ditemukan.');
    }

    // The target day must belong to the receiver (the day we'll take over).
    const jadwalMereka = await this.prisma.jadwal.findFirst({
      where: { rumahId: anggota.rumahId, tanggal: tanggalMereka },
    });
    if (!jadwalMereka) {
      throw new BadRequestException(
        'Tidak ada jadwal piket pada tanggal penerima.',
      );
    }
    if (jadwalMereka.anggotaId !== receiver.id) {
      throw new BadRequestException(
        `${receiver.nama} tidak memiliki jadwal piket pada tanggal tersebut.`,
      );
    }

    const duplicate = await this.prisma.swapRequest.findFirst({
      where: {
        dariAnggotaId: anggota.id,
        tanggal: tanggalLo,
        status: 'diajukan',
      },
    });
    if (duplicate) {
      throw new ConflictException(
        'Swap untuk tanggal tersebut masih diajukan.',
      );
    }

    const swapRequest = await this.prisma.swapRequest.create({
      data: {
        dariAnggotaId: anggota.id,
        keAnggotaId: receiver.id,
        tanggal: tanggalLo,
        tanggalKe: tanggalMereka,
        status: 'diajukan',
      },
    });

    this.logger.log(
      `[SwapService] ${anggota.nama} swap ${tanggalLo.toISOString()} ⇄ ${tanggalMereka.toISOString()} (${receiver.nama})`,
    );
    await this.notifications.notifySwapIncoming(receiver.id, anggota.nama);
    return { swapRequest };
  }

  async accept(payload: CurrentUserPayload, swapId: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    const rumahId = anggota.rumahId;
    const swap = await this.getOpenSwap(swapId, anggota);

    // Reject swaps for days that already have a submission.
    const existingSubmission = await this.prisma.piketSubmission.findFirst({
      where: {
        jadwal: { rumahId, tanggal: { in: [swap.tanggal, swap.tanggalKe] } },
      },
    });
    if (existingSubmission) {
      throw new ConflictException(
        'Tidak dapat menukar hari yang sudah dikerjakan.',
      );
    }

    // Mutual all-or-nothing: the requester's day moves to the receiver, and
    // the receiver's day moves to the requester.
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.jadwal.updateMany({
        where: { rumahId, tanggal: swap.tanggal },
        data: { anggotaId: anggota.id },
      });
      await tx.jadwal.updateMany({
        where: { rumahId, tanggal: swap.tanggalKe },
        data: { anggotaId: swap.dariAnggotaId },
      });
      return tx.swapRequest.update({
        where: { id: swap.id },
        data: { status: 'diterima' },
      });
    });

    this.logger.log(
      `[SwapService] Swap ${swap.id} diterima oleh ${anggota.nama}`,
    );
    await this.notifications.notifySwapAccepted(swap.dariAnggotaId, anggota.nama);
    return { swapRequest: updated };
  }

  async reject(payload: CurrentUserPayload, swapId: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    const swap = await this.getOpenSwap(swapId, anggota);

    const updated = await this.prisma.swapRequest.update({
      where: { id: swap.id },
      data: { status: 'ditolak' },
    });

    this.logger.log(
      `[SwapService] Swap ${swap.id} ditolak oleh ${anggota.nama}`,
    );
    await this.notifications.notifySwapRejected(swap.dariAnggotaId, anggota.nama);
    return { swapRequest: updated };
  }

  private async getOpenSwap(swapId: string, anggota: { id: string }) {
    const swap = await this.prisma.swapRequest.findUnique({
      where: { id: swapId },
    });
    if (!swap) throw new NotFoundException('Swap tidak ditemukan.');
    if (swap.keAnggotaId !== anggota.id) {
      throw new ForbiddenException('Hanya penerima yang dapat merespons swap.');
    }
    if (swap.status !== 'diajukan') {
      throw new ConflictException('Swap sudah diproses.');
    }
    return swap;
  }
}
