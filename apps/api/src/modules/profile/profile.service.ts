import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
    const existing = await this.prisma.anggota.findUnique({
      where: { id: payload.userId },
    });

    if (!existing && !dto.nama) {
      throw new BadRequestException('Nama wajib diisi untuk membuat profil.');
    }

    const anggota = await this.prisma.anggota.upsert({
      where: { id: payload.userId },
      create: {
        id: payload.userId,
        nama: dto.nama!,
        fotoProfil: dto.fotoProfil,
        kontakDarurat: dto.kontakDarurat,
        alamat: dto.alamat,
      },
      update: {
        nama: dto.nama ?? undefined,
        fotoProfil: dto.fotoProfil ?? undefined,
        kontakDarurat: dto.kontakDarurat ?? undefined,
        alamat: dto.alamat ?? undefined,
      },
    });

    this.logger.log(`[ProfileService] Profil diperbarui: ${anggota.id}`);
    return { anggota };
  }
}
