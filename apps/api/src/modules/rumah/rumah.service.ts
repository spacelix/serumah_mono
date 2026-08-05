import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '@serumah/db/prisma';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CreateRumahDto, JoinRumahDto } from './dto/rumah.dto';

@Injectable()
export class RumahService {
  private readonly logger = new Logger(RumahService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createRumah(payload: CurrentUserPayload, dto: CreateRumahDto) {
    const anggota = await this.prisma.anggota.findUnique({
      where: { id: payload.userId },
    });
    if (!anggota) {
      throw new BadRequestException(
        'Lengkapi profil terlebih dahulu sebelum membuat kos.',
      );
    }

    const inviteCode = await this.generateUniqueInviteCode();

    const rumah = await this.prisma.$transaction(async (tx) => {
      const created = await tx.rumah.create({
        data: {
          nama: dto.nama,
          alamat: dto.alamat,
          inviteCode,
          createdById: payload.userId,
        },
      });
      await tx.anggota.update({
        where: { id: payload.userId },
        data: { rumahId: created.id, role: 'admin' },
      });
      return created;
    });

    this.logger.log(
      `[RumahService] Kos dibuat oleh ${payload.userId}: ${rumah.id}`,
    );
    return { rumah, inviteCode };
  }

  async previewJoin(kode: string) {
    const rumah = await this.prisma.rumah.findUnique({
      where: { inviteCode: kode },
      include: { _count: { select: { anggota: true } } },
    });
    if (!rumah) {
      throw new NotFoundException('Kode undangan tidak valid.');
    }
    return {
      nama: rumah.nama,
      alamat: rumah.alamat,
      anggotaCount: rumah._count.anggota,
    };
  }

  async joinRumah(payload: CurrentUserPayload, dto: JoinRumahDto) {
    const rumah = await this.prisma.rumah.findUnique({
      where: { inviteCode: dto.inviteCode },
    });
    if (!rumah) {
      throw new NotFoundException('Kode undangan tidak valid.');
    }

    const anggota = await this.prisma.anggota.findUnique({
      where: { id: payload.userId },
    });
    if (!anggota) {
      throw new BadRequestException(
        'Lengkapi profil terlebih dahulu sebelum bergabung.',
      );
    }

    await this.prisma.anggota.update({
      where: { id: payload.userId },
      data: { rumahId: rumah.id, role: 'anggota' },
    });

    this.logger.log(
      `[RumahService] ${payload.userId} bergabung ke ${rumah.id}`,
    );
    return { rumah };
  }

  private async generateUniqueInviteCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      const existing = await this.prisma.rumah.findUnique({
        where: { inviteCode: code },
      });
      if (!existing) {
        return code;
      }
    }
    throw new BadRequestException(
      'Gagal membuat kode undangan. Silakan coba lagi.',
    );
  }
}
