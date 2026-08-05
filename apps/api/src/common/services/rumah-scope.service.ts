import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@serumah/db/prisma';
import type { Anggota, Rumah } from '@serumah/db';

/**
 * Shared rumah-scope helpers for feature services.
 *
 * Every M3 service enforces two invariants here:
 * 1. The caller belongs to the rumah being touched (rumah_id scoping).
 * 2. Exactly one PJ/admin exists per rumah — resolved by role marker,
 *    never a second writer. See locked decision TBC-2 (review = admin only).
 */
@Injectable()
export class RumahScopeService {
  private readonly logger = new Logger(RumahScopeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Loads the caller's anggota (must exist and belong to a rumah). */
  async requireAnggota(userId: string): Promise<Anggota> {
    const anggota = await this.prisma.anggota.findUnique({
      where: { id: userId },
    });
    if (!anggota) {
      throw new NotFoundException('Anggota tidak ditemukan.');
    }
    return anggota;
  }

  /** Loads a rumah and verifies the caller is a member of it. */
  async requireRumah(rumahId: string): Promise<Rumah> {
    const rumah = await this.prisma.rumah.findUnique({
      where: { id: rumahId },
    });
    if (!rumah) {
      throw new NotFoundException('Kos tidak ditemukan.');
    }
    return rumah;
  }

  /**
   * Verifies the caller is a member of the given rumah and returns their row.
   * Throws Forbidden when the caller is not part of that rumah.
   */
  async requireMembership(userId: string, rumahId: string): Promise<Anggota> {
    const anggota = await this.prisma.anggota.findUnique({
      where: { id: userId },
    });
    if (!anggota || anggota.rumahId !== rumahId) {
      throw new ForbiddenException('Anda bukan anggota kos ini.');
    }
    return anggota;
  }

  /** Resolves the single PJ/admin of a rumah (first `role='admin'` member). */
  async getPj(rumahId: string): Promise<Anggota> {
    const pj = await this.prisma.anggota.findFirst({
      where: { rumahId, role: 'admin' },
      orderBy: { createdAt: 'asc' },
    });
    if (!pj) {
      this.logger.error(
        `[RumahScopeService] Kos ${rumahId} tidak memiliki PJ (admin).`,
      );
      throw new NotFoundException(
        'Kos ini belum memiliki PJ. Hubungi pengelola kos.',
      );
    }
    return pj;
  }

  /** Verifies the caller is the PJ of a rumah (throws Forbidden otherwise). */
  async requirePj(userId: string, rumahId: string): Promise<Anggota> {
    const pj = await this.getPj(rumahId);
    if (pj.id !== userId) {
      throw new ForbiddenException(
        'Hanya PJ kos yang dapat melakukan aksi ini.',
      );
    }
    return pj;
  }

  /** True when the caller is the PJ of the rumah. */
  async isPj(userId: string, rumahId: string): Promise<boolean> {
    const pj = await this.getPj(rumahId);
    return pj.id === userId;
  }
}
