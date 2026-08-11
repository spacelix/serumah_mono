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
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UploadBuktiDto } from './dto/denda.dto';

// Asia/Jakarta is UTC+7, no DST. The month filter is a WIB calendar month, so
// its UTC range is built from UTC-midnight shifted by -7h (a "month" seen by a
// WIB user starts at 2026-08-01T00:00+07 = 2026-07-31T17:00Z).
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

@Injectable()
export class DendaService {
  private readonly logger = new Logger(DendaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RumahScopeService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
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
        anggota: { select: { id: true, nama: true } },
        reviewer: { select: { id: true, nama: true } },
        submission: {
          include: {
            jadwal: { select: { tanggal: true } },
            proofs: {
              include: { ruangan: { select: { nama: true } } },
            },
            approvals: {
              orderBy: { reviewedAt: 'desc' },
              take: 1,
              select: { reviewer: { select: { nama: true } } },
            },
          },
        },
      },
    });

    // Active rooms + their jenis names, to resolve the cause detail per room.
    const rooms = await this.prisma.ruangan.findMany({
      where: {
        rumahId: anggota.rumahId,
        jenisPiket: { some: { isActive: true } },
      },
      include: { jenisPiket: { where: { isActive: true } } },
    });
    const roomJenis = new Map<string, string[]>();
    const jenisName = new Map<string, string>();
    for (const room of rooms) {
      roomJenis.set(room.id, room.jenisPiket.map((j) => j.nama));
      for (const j of room.jenisPiket) jenisName.set(j.id, j.nama);
    }
    const resolveJenis = (ids: string[]) =>
      ids.map((id) => jenisName.get(id) ?? id);

    const rumah = await this.prisma.rumah.findUnique({
      where: { id: anggota.rumahId },
      select: { qrisUrl: true },
    });

    return {
      qrisUrl: rumah?.qrisUrl ?? null,
      denda: denda.map((d) => {
        // Fine origin decides the meta line on the bill card:
        // - 'auto'    → piket not done at all, auto-fine at 20:00 deadline.
        // - 'partial' → submission approved but some jenis_piket unchecked.
        // - 'rejected' → submission rejected (full flat fine).
        const submissionStatus = d.submission?.status;
        const origin: 'auto' | 'partial' | 'rejected' =
          submissionStatus === 'approved'
            ? 'partial'
            : submissionStatus === 'rejected'
              ? 'rejected'
              : 'auto';
        const reviewerNama =
          d.submission?.approvals[0]?.reviewer?.nama ?? null;

        // Cause detail per room (from the linked submission's proofs).
        const detail = d.submission
          ? d.submission.proofs.map((p) => {
            const done = new Set(resolveJenis(p.jenisSelesai));
            return {
              ruanganNama: p.ruangan.nama,
              fotoBefore: p.fotoBefore,
              fotoAfter: p.fotoAfter,
              jenisSelesai: [...done],
              jenisList: roomJenis.get(p.ruanganId) ?? [...done],
            };
          })
          : [];

        return {
          id: d.id,
          anggota: d.anggota,
          nominal: d.nominal,
          status: d.status,
          bayarKeAnggotaId: d.bayarKeAnggotaId,
          reviewerId: d.reviewerId,
          reviewerNama,
          paymentReviewerNama: d.reviewer?.nama ?? null,
          buktiBayar: d.buktiBayar,
          createdAt: d.createdAt,
          origin,
          tanggal: d.submission?.jadwal.tanggal ?? null,
          detail,
        };
      }),
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

    // Assigned reviewer (locked 2026-08-10): member → PJ; PJ → round-robin
    // non-PJ member. PJ's own fine is NO LONGER auto-lunas — it must be
    // confirmed by another member (no self-confirmation).
    const reviewerId = await this.scope.assignPaymentReviewer(
      anggota.rumahId!,
      anggota.id,
      await this.prisma.denda.count({
        where: { anggotaId: anggota.id },
      }),
    );

    // Payment receiver is always the PJ (QRIS owner).
    const pj = await this.scope.getPj(anggota.rumahId!);
    await this.prisma.denda.update({
      where: { id: denda.id },
      data: {
        status: 'menunggu_konfirmasi',
        reviewerId,
        buktiBayar: dto.buktiUrl,
        bayarKeAnggotaId: pj.id,
      },
    });

    this.logger.log(
      `[DendaService] Denda ${denda.id} menunggu konfirmasi (reviewer ${reviewerId}).`,
    );
    await this.notifications.notifyPaymentReviewer(reviewerId, 'denda');
    this.realtime.emitToRumah(anggota.rumahId!, 'denda:updated', {
      id: denda.id,
      status: 'menunggu_konfirmasi',
    });
    return { status: 'menunggu_konfirmasi', receiverId: pj.id, reviewerId };
  }

  async approve(payload: CurrentUserPayload, dendaId: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    const denda = await this.getPendingDendaForReview(
      dendaId,
      anggota.rumahId!,
      anggota.id,
    );

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
    this.realtime.emitToRumah(anggota.rumahId!, 'denda:updated', {
      id: denda.id,
      status: 'lunas',
    });
    return { denda: { id: denda.id, status: 'lunas' } };
  }

  async reject(payload: CurrentUserPayload, dendaId: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    const denda = await this.getPendingDendaForReview(
      dendaId,
      anggota.rumahId!,
      anggota.id,
    );

    await this.prisma.$transaction([
      this.prisma.denda.update({
        where: { id: denda.id },
        data: {
          status: 'belum_bayar',
          bayarKeAnggotaId: null,
          reviewerId: null,
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
    this.realtime.emitToRumah(anggota.rumahId!, 'denda:updated', {
      id: denda.id,
      status: 'belum_bayar',
    });
    return { denda: { id: denda.id, status: 'belum_bayar' } };
  }

  /**
   * Only the assigned reviewer may approve/reject a pending payment —
   * member payments → PJ, PJ payments → round-robin member.
   */
  private async getPendingDendaForReview(
    dendaId: string,
    rumahId: string,
    reviewerId: string,
  ) {
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
    if (denda.reviewerId !== reviewerId) {
      throw new ForbiddenException(
        'Bukan giliran Anda untuk memverifikasi pembayaran ini.',
      );
    }
    if (denda.anggotaId === reviewerId) {
      throw new ForbiddenException(
        'Anda tidak dapat memverifikasi pembayaran sendiri.',
      );
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
    // Filter `createdAt` (a timestamptz) by the WIB calendar month: start of
    // the 1st = UTC-midnight − 7h; end = start of the next month − 7h.
    return {
      start: new Date(Date.UTC(year, month, 1) - WIB_OFFSET_MS),
      end: new Date(Date.UTC(year, month + 1, 1) - WIB_OFFSET_MS),
    };
  }
}
