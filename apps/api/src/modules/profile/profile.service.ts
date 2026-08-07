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
        user: {
          select: {
            email: true,
          },
        },
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

    if (anggota?.user) {
      // expose email as top-level field on anggota while keeping the shape
      const { user: _user, ...rest } = anggota;
      return {
        anggota: {
          ...rest,
          email: anggota.user.email,
        },
        rumah: anggota?.rumah ?? null,
      };
    }

    return { anggota, rumah: anggota?.rumah ?? null };
  }

  async updateProfile(payload: CurrentUserPayload, dto: UpdateProfileDto) {
    const existing = await this.prisma.anggota.findUnique({
      where: { id: payload.userId },
    });

    if (!existing && !dto.nama) {
      throw new BadRequestException('Nama wajib diisi untuk membuat profil.');
    }

    const anggota = existing
      ? await this.prisma.anggota.update({
          where: { id: payload.userId },
          data: {
            nama: dto.nama ?? undefined,
            fotoProfil: dto.fotoProfil,
            kontakDarurat: dto.kontakDarurat ?? undefined,
            alamat: dto.alamat ?? undefined,
          },
        })
      : await this.prisma.anggota.create({
          data: {
            id: payload.userId,
            nama: dto.nama!,
            fotoProfil: dto.fotoProfil,
            kontakDarurat: dto.kontakDarurat,
            alamat: dto.alamat,
          },
        });

    this.logger.log(`[ProfileService] Profil diperbarui: ${anggota.id}`);
    return { anggota };
  }

  async getStats(payload: CurrentUserPayload) {
    const [piketSelesai, belumLunas] = await Promise.all([
      this.prisma.piketSubmission.count({
        where: { anggotaId: payload.userId, status: 'approved' },
      }),
      this.prisma.denda.aggregate({
        where: { anggotaId: payload.userId, status: { not: 'lunas' } },
        _sum: { nominal: true },
      }),
    ]);

    return {
      piketSelesai,
      totalBelumLunas: belumLunas._sum.nominal ?? 0,
    };
  }
}
