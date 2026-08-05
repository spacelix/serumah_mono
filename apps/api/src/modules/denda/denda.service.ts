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
import { UploadBuktiDto } from './dto/denda.dto';

@Injectable()
export class DendaService {
  private readonly logger = new Logger(DendaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RumahScopeService,
  ) {}

  async list(payload: CurrentUserPayload, bulan?: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) return [];

    const filter = this.monthRange(bulan);
    const denda = await this.prisma.denda.findMany({
      where: {
        anggota: { rumahId: anggota.rumahId },
        createdAt: filter ? { gte: filter.start, lt: filter.end } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        anggota: { select: { id: true, nama: true, kamar: true } },
      },
    });

    const rumah = await this.prisma.rumah.findUnique({
      where: { id: anggota.rumahId },
      select: { qrisUrl: true },
    });

    return {
      qrisUrl: rumah?.qrisUrl ?? null,
      denda: denda.map((d) => ({
        id: d.id,
        anggota: d.anggota,
        nominal: d.nominal,
        status: d.status,
        bayarKeAnggotaId: d.bayarKeAnggotaId,
        buktiBayar: d.buktiBayar,
        createdAt: d.createdAt,
      })),
    };
  }

  async uploadBukti(
    payload: CurrentUserPayload,
    dendaId: string,
    dto: UploadBuktiDto,
  ) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    const denda = await this.prisma.denda.findUnique({
      where: { id: dendaId },
      include: { anggota: true },
    });
    if (!denda || denda.anggota.rumahId !== anggota.rumahId) {
      throw new NotFoundException('Denda tidak ditemukan.');
    }
    if (denda.anggotaId !== anggota.id) {
      throw new ForbiddenException('Denda ini bukan milik Anda.');
    }
    if (denda.status !== 'belum_bayar') {
      throw new ConflictException('Denda sudah memiliki status pembayaran.');
    }

    const isPj = await this.scope.isPj(anggota.id, anggota.rumahId!);

    if (isPj) {
      // PJ/Admin's own fine → directly lunas (no self-confirmation).
      await this.prisma.denda.update({
        where: { id: denda.id },
        data: {
          status: 'lunas',
          buktiBayar: dto.buktiUrl,
          bayarKeAnggotaId: anggota.id,
        },
      });
      this.logger.log(`[DendaService] Denda ${denda.id} lunas (PJ).`);
      return { status: 'lunas', receiverId: anggota.id };
    }

    const pj = await this.scope.getPj(anggota.rumahId!);
    await this.prisma.denda.update({
      where: { id: denda.id },
      data: {
        status: 'menunggu_konfirmasi',
        buktiBayar: dto.buktiUrl,
        bayarKeAnggotaId: pj.id,
      },
    });
    this.logger.log(`[DendaService] Denda ${denda.id} menunggu konfirmasi.`);
    return { status: 'menunggu_konfirmasi', receiverId: pj.id };
  }

  async approve(payload: CurrentUserPayload, dendaId: string) {
    const anggota = await this.requireReviewer(payload);
    const denda = await this.getPendingDenda(dendaId, anggota.rumahId!);

    await this.prisma.$transaction([
      this.prisma.denda.update({
        where: { id: denda.id },
        data: { status: 'lunas' },
      }),
      this.prisma.pembayaranApproval.create({
        data: {
          dendaId: denda.id,
          approverId: anggota.id,
          status: 'approved',
        },
      }),
    ]);

    this.logger.log(`[DendaService] Denda ${denda.id} disetujui.`);
    return { denda: { id: denda.id, status: 'lunas' } };
  }

  async reject(payload: CurrentUserPayload, dendaId: string) {
    const anggota = await this.requireReviewer(payload);
    const denda = await this.getPendingDenda(dendaId, anggota.rumahId!);

    await this.prisma.$transaction([
      this.prisma.denda.update({
        where: { id: denda.id },
        data: {
          status: 'belum_bayar',
          bayarKeAnggotaId: null,
          buktiBayar: null,
        },
      }),
      this.prisma.pembayaranApproval.create({
        data: {
          dendaId: denda.id,
          approverId: anggota.id,
          status: 'rejected',
        },
      }),
    ]);

    this.logger.log(`[DendaService] Denda ${denda.id} ditolak.`);
    return { denda: { id: denda.id, status: 'belum_bayar' } };
  }

  private async requireReviewer(payload: CurrentUserPayload) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    return this.scope.requirePj(payload.userId, anggota.rumahId);
  }

  private async getPendingDenda(dendaId: string, rumahId: string) {
    const denda = await this.prisma.denda.findUnique({
      where: { id: dendaId },
      include: { anggota: true },
    });
    if (!denda || denda.anggota.rumahId !== rumahId) {
      throw new NotFoundException('Denda tidak ditemukan.');
    }
    if (denda.status !== 'menunggu_konfirmasi') {
      throw new ConflictException('Denda tidak menunggu konfirmasi.');
    }
    return denda;
  }

  private monthRange(bulan?: string): { start: Date; end: Date } | null {
    if (!bulan) return null;
    const match = /^(\d{4})-(\d{2})$/.exec(bulan);
    if (!match) {
      throw new BadRequestException('Format bulan harus YYYY-MM.');
    }
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    return {
      start: new Date(year, month, 1),
      end: new Date(year, month + 1, 1),
    };
  }
}
