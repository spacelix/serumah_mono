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
import { CreateSwapDto } from './dto/swap.dto';

const PIKET_WEEKDAYS = [1, 3, 5];

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RumahScopeService,
  ) {}

  private toDate(date: Date | string): Date {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
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
      .filter((d) => PIKET_WEEKDAYS.includes(d.getDay()))
      .sort((a, b) => a.getTime() - b.getTime());

    return days;
  }

  async create(payload: CurrentUserPayload, dto: CreateSwapDto) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    if (dto.keAnggotaId === anggota.id) {
      throw new BadRequestException('Tidak dapat menukar dengan diri sendiri.');
    }

    const target = this.toDate(dto.tanggal);

    // Must be an already-scheduled piket day for this user.
    const jadwal = await this.prisma.jadwal.findFirst({
      where: { rumahId: anggota.rumahId, tanggal: target },
    });
    if (!jadwal) {
      throw new BadRequestException(
        'Tidak ada jadwal piket pada tanggal tersebut.',
      );
    }
    if (jadwal.anggotaId !== anggota.id) {
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

    const duplicate = await this.prisma.swapRequest.findFirst({
      where: {
        dariAnggotaId: anggota.id,
        tanggal: target,
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
        tanggal: target,
        status: 'diajukan',
      },
    });

    this.logger.log(
      `[SwapService] ${anggota.nama} swap ${target.toISOString()} → ${receiver.nama}`,
    );
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
      where: { jadwal: { rumahId, tanggal: swap.tanggal } },
    });
    if (existingSubmission) {
      throw new ConflictException(
        'Tidak dapat menukar hari yang sudah dikerjakan.',
      );
    }

    // Move the schedule for that day to the receiver (all-or-nothing).
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.jadwal.updateMany({
        where: { rumahId, tanggal: swap.tanggal },
        data: { anggotaId: anggota.id },
      });
      return tx.swapRequest.update({
        where: { id: swap.id },
        data: { status: 'diterima' },
      });
    });

    this.logger.log(
      `[SwapService] Swap ${swap.id} diterima oleh ${anggota.nama}`,
    );
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
