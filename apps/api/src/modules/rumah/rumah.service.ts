import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '@serumah/db/prisma';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RumahScopeService } from '../../common/services/rumah-scope.service';
import { CreateRumahDto, JoinRumahDto, UpdateRumahDto } from './dto/rumah.dto';

@Injectable()
export class RumahService {
  private readonly logger = new Logger(RumahService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RumahScopeService,
  ) {}

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

  /** Rumah detail + member list for the current user. Admin flag computed here. */
  async getMe(payload: CurrentUserPayload) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      return { rumah: null, anggotaList: [], currentRole: null };
    }

    const [rumah, anggotaList] = await Promise.all([
      this.prisma.rumah.findUnique({
        where: { id: anggota.rumahId },
      }),
      this.prisma.anggota.findMany({
        where: { rumahId: anggota.rumahId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          nama: true,
          fotoProfil: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      rumah,
      anggotaList,
      currentRole: anggota.role,
    };
  }

  /** Admin-only: update rumah costs / rekening. */
  async updateMe(payload: CurrentUserPayload, dto: UpdateRumahDto) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    await this.scope.requirePj(payload.userId, anggota.rumahId);

    const rumah = await this.prisma.rumah.update({
      where: { id: anggota.rumahId },
      data: {
        nama: dto.nama,
        alamat: dto.alamat,
        biayaKos: dto.biayaKos,
        biayaWifi: dto.biayaWifi,
        biayaListrikWajib: dto.biayaListrikWajib,
        nominalDenda: dto.nominalDenda,
        rekeningBank: dto.rekeningBank,
        rekeningNomor: dto.rekeningNomor,
        rekeningNama: dto.rekeningNama,
      },
    });

    this.logger.log(`[RumahService] Kos ${rumah.id} diperbarui oleh PJ.`);
    return { rumah };
  }

  /** Admin-only: generate a fresh 6-digit invite code. */
  async resetInvite(payload: CurrentUserPayload) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    await this.scope.requirePj(payload.userId, anggota.rumahId);

    const inviteCode = await this.generateUniqueInviteCode();
    await this.prisma.rumah.update({
      where: { id: anggota.rumahId },
      data: { inviteCode },
    });

    this.logger.log(
      `[RumahService] Kode undangan direset untuk kos ${anggota.rumahId}.`,
    );
    return { inviteCode };
  }

  /** Admin-only: set/replace the QRIS image URL for fine payment. */
  async setQris(payload: CurrentUserPayload, qrisUrl: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    await this.scope.requirePj(payload.userId, anggota.rumahId);

    const rumah = await this.prisma.rumah.update({
      where: { id: anggota.rumahId },
      data: { qrisUrl },
    });

    this.logger.log(`[RumahService] QRIS diperbarui untuk kos ${rumah.id}.`);
    return { rumah };
  }

  /** Admin-only: remove a member (set rumahId = null, not account deletion). */
  async removeAnggota(payload: CurrentUserPayload, anggotaId: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    await this.scope.requirePj(payload.userId, anggota.rumahId);

    if (anggotaId === payload.userId) {
      throw new ForbiddenException('PJ tidak dapat menghapus diri sendiri.');
    }

    const target = await this.prisma.anggota.findUnique({
      where: { id: anggotaId },
    });
    if (!target || target.rumahId !== anggota.rumahId) {
      throw new NotFoundException('Anggota tidak ditemukan.');
    }

    await this.prisma.anggota.update({
      where: { id: anggotaId },
      data: { rumahId: null, role: 'anggota' },
    });

    this.logger.log(
      `[RumahService] Anggota ${anggotaId} dihapus dari kos ${anggota.rumahId}.`,
    );
    return { success: true };
  }

  /** Member self-leave: detach from rumah. Admin cannot leave (would orphan the kos). */
  async leaveRumah(payload: CurrentUserPayload) {
    const anggota = await this.prisma.anggota.findUnique({
      where: { id: payload.userId },
    });
    if (!anggota?.rumahId) {
      throw new BadRequestException('Kamu tidak tergabung di kos mana pun.');
    }
    if (anggota.role === 'admin') {
      throw new ForbiddenException(
        'PJ Kos tidak bisa keluar dari kos. Pindahkan peran PJ ke anggota lain dulu.',
      );
    }

    await this.prisma.anggota.update({
      where: { id: payload.userId },
      data: { rumahId: null, role: 'anggota' },
    });

    this.logger.log(
      `[RumahService] Anggota ${payload.userId} keluar dari kos ${anggota.rumahId}.`,
    );
    return { success: true };
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
