import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@serumah/db/prisma';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProfile(payload: CurrentUserPayload) {
    const anggota = await this.prisma.anggota.findUnique({
      where: { id: payload.userId },
      include: {
        rumah: {
          select: {
            id: true,
            nama: true,
            alamat: true,
            inviteCode: true,
          },
        },
      },
    });

    return { anggota, rumah: anggota?.rumah ?? null };
  }

  async updateProfile(payload: CurrentUserPayload, dto: UpdateProfileDto) {
    const anggota = await this.prisma.anggota.findUnique({
      where: { id: payload.userId },
    });
    if (!anggota) {
      throw new NotFoundException(
        'Profil tidak ditemukan. Selesaikan onboarding terlebih dahulu.',
      );
    }

    const updated = await this.prisma.anggota.update({
      where: { id: payload.userId },
      data: {
        nama: dto.nama ?? undefined,
        fotoProfil: dto.fotoProfil ?? undefined,
        kontakDarurat: dto.kontakDarurat ?? undefined,
        alamat: dto.alamat ?? undefined,
      },
    });

    this.logger.log(`[ProfileService] Profil diperbarui: ${updated.id}`);
    return { anggota: updated };
  }
}
