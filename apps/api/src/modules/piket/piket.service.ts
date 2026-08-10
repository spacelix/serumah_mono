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
import { CreateSubmissionDto } from './dto/piket.dto';

// Asia/Jakarta is UTC+7, no DST. `jadwal.tanggal` is stored as `@db.Date`
// (Prisma persists UTC components) — so calendar math uses UTC-midnight dates
// and resolves "today" by shifting +7h (same rule as schedule/dashboard).
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

@Injectable()
export class PiketService {
  private readonly logger = new Logger(PiketService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RumahScopeService,
    private readonly notifications: NotificationsService,
  ) { }

  private today(): Date {
    const now = new Date();
    const wib = new Date(now.getTime() + WIB_OFFSET_MS);
    return new Date(
      Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()),
    );
  }

  async getToday(payload: CurrentUserPayload) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      return {
        jadwal: null,
        ruangan: [],
        jenisByRuangan: {},
        existingSubmission: null,
      };
    }

    const today = this.today();
    const jadwal = await this.prisma.jadwal.findFirst({
      where: { rumahId: anggota.rumahId, tanggal: today },
      include: {
        anggota: { select: { id: true, nama: true } },
        submissions: {
          include: {
            proofs: true,
            reviewer: { select: { id: true, nama: true } },
          },
        },
      },
    });

    // Active rooms with their active jenis checklist.
    const ruangan = await this.prisma.ruangan.findMany({
      where: {
        rumahId: anggota.rumahId,
        jenisPiket: { some: { isActive: true } },
      },
      orderBy: { urutan: 'asc' },
      include: {
        jenisPiket: {
          where: { isActive: true },
          orderBy: { id: 'asc' },
        },
      },
    });

    const jenisByRuangan: Record<string, { id: string; nama: string }[]> = {};
    let totalJenis = 0;
    for (const room of ruangan) {
      jenisByRuangan[room.id] = room.jenisPiket.map((j) => ({
        id: j.id,
        nama: j.nama,
      }));
      totalJenis += room.jenisPiket.length;
    }

    const jenisName = new Map<string, string>();
    for (const room of ruangan) {
      for (const j of room.jenisPiket) jenisName.set(j.id, j.nama);
    }
    const resolveJenis = (ids: string[]) =>
      ids.map((id) => jenisName.get(id) ?? id);

    const existingSubmission = jadwal?.submissions[0]
      ? {
        id: jadwal.submissions[0].id,
        status: jadwal.submissions[0].status,
        submittedAt: jadwal.submissions[0].submittedAt,
        reviewerId: jadwal.submissions[0].reviewerId,
        reviewerName: jadwal.submissions[0].reviewer?.nama ?? null,
        proofs: jadwal.submissions[0].proofs.map((p) => ({
          ruanganId: p.ruanganId,
          fotoBefore: p.fotoBefore,
          fotoAfter: p.fotoAfter,
          jenisSelesai: resolveJenis(p.jenisSelesai),
        })),
      }
      : null;

    const rumah = anggota.rumahId
      ? await this.prisma.rumah.findUnique({
        where: { id: anggota.rumahId },
        select: { nominalDenda: true },
      })
      : null;

    return {
      jadwal: jadwal
        ? {
          id: jadwal.id,
          tanggal: jadwal.tanggal,
          anggotaId: jadwal.anggotaId,
          anggota: jadwal.anggota,
          ruangan: jadwal.ruangan,
          isMine: jadwal.anggotaId === anggota.id,
        }
        : null,
      ruangan: ruangan.map((room) => ({ id: room.id, nama: room.nama })),
      jenisByRuangan,
      totalJenis,
      existingSubmission,
      nominalDenda: rumah?.nominalDenda ?? 0,
    };
  }

  async createSubmission(
    payload: CurrentUserPayload,
    dto: CreateSubmissionDto,
  ) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }

    const today = this.today();
    const jadwal = await this.prisma.jadwal.findUnique({
      where: { id: dto.jadwalId },
      include: { submissions: true, anggota: true },
    });

    if (!jadwal || jadwal.rumahId !== anggota.rumahId) {
      throw new BadRequestException('Jadwal tidak ditemukan.');
    }
    if (jadwal.anggotaId !== anggota.id) {
      throw new ForbiddenException('Bukan giliran Anda pada hari ini.');
    }
    if (this.toDay(jadwal.tanggal).getTime() !== today.getTime()) {
      throw new BadRequestException(
        'Pengumpulan hanya dapat dilakukan pada hari jadwal piket.',
      );
    }

    const existing = jadwal.submissions[0];
    if (existing) {
      if (existing.status === 'rejected') {
        throw new ConflictException(
          'Pengumpulan yang ditolak tidak dapat diajukan ulang dan telah dikenakan denda.',
        );
      }
      throw new ConflictException('Piket untuk hari ini sudah dikumpulkan.');
    }

    // Rooms that must be completed = active rooms. Server validates each:
    // a room with at least one checked jenis REQUIRES before+after photos;
    // a room with zero checked jenis is treated as "not worked" (no photos,
    // its items count toward the proportional fine).
    const activeRooms = await this.prisma.ruangan.findMany({
      where: {
        rumahId: anggota.rumahId,
        jenisPiket: { some: { isActive: true } },
      },
      select: { id: true },
    });
    const activeRoomIds = new Set(activeRooms.map((r) => r.id));

    const submittedRoomIds = new Set<string>();
    for (const proof of dto.proofs) {
      if (!activeRoomIds.has(proof.ruanganId)) {
        throw new BadRequestException(
          'Terdapat bukti untuk ruangan di luar kewajiban piket.',
        );
      }
      submittedRoomIds.add(proof.ruanganId);
    }

    // Every active room must appear exactly once.
    for (const id of activeRoomIds) {
      if (!submittedRoomIds.has(id)) {
        throw new BadRequestException(
          'Semua ruangan wajib dimasukkan ke pengumpulan.',
        );
      }
    }

    // A checked room (jenisSelesai non-empty) must carry both photos.
    for (const proof of dto.proofs) {
      if ((proof.jenisSelesai ?? []).length > 0) {
        if (!proof.fotoBeforeUrl || !proof.fotoAfterUrl) {
          throw new BadRequestException(
            'Ruangan yang dikerjakan wajib punya foto sebelum & sesudah.',
          );
        }
      }
    }

    let reviewerId = '';
    const submission = await this.prisma.$transaction(async (tx) => {
      reviewerId = await this.assignReviewer(
        anggota.rumahId!,
        anggota.id,
      );
      const created = await tx.piketSubmission.create({
        data: {
          jadwalId: jadwal.id,
          anggotaId: anggota.id,
          reviewerId,
          status: 'menunggu',
          submittedAt: new Date(),
        },
      });

      for (const proof of dto.proofs) {
        await tx.ruanganProof.create({
          data: {
            submissionId: created.id,
            ruanganId: proof.ruanganId,
            fotoBefore: proof.fotoBeforeUrl ?? null,
            fotoAfter: proof.fotoAfterUrl ?? null,
            jenisSelesai: proof.jenisSelesai ?? [],
          },
        });
      }

      return tx.piketSubmission.findUniqueOrThrow({
        where: { id: created.id },
        include: { proofs: true },
      });
    });

    this.logger.log(
      `[PiketService] Submission ${submission.id} (${anggota.nama})`,
    );
    if (reviewerId) {
      await this.notifications.notifyPiketReviewer(reviewerId, anggota.nama);
    }
    return { submission };
  }

  private toDay(date: Date): Date {
    const wib = new Date(date.getTime() + WIB_OFFSET_MS);
    return new Date(
      Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()),
    );
  }

  // ── VERIFIKASI (approval) ────────────────────────────────────────────
  async listSubmissions(
    payload: CurrentUserPayload,
    status: 'pending' | 'resolved',
  ) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) return [];

    const isPending = status === 'pending';
    const submissions = await this.prisma.piketSubmission.findMany({
      where: {
        jadwal: { rumahId: anggota.rumahId },
        // Pending → only submissions assigned to THIS reviewer.
        // Resolved → only submissions this reviewer acted on.
        ...(isPending
          ? { status: 'menunggu', reviewerId: anggota.id }
          : {
            status: { in: ['approved', 'rejected'] },
            approvals: { some: { reviewerId: anggota.id } },
          }),
      },
      orderBy: { submittedAt: isPending ? 'asc' : 'desc' },
      include: {
        anggota: { select: { id: true, nama: true } },
        jadwal: { select: { tanggal: true } },
        approvals: {
          include: {
            reviewer: { select: { id: true, nama: true } },
          },
          orderBy: { reviewedAt: 'asc' },
        },
        proofs: {
          include: {
            ruangan: { select: { id: true, nama: true } },
          },
        },
      },
    });

    const rumah = await this.prisma.rumah.findUnique({
      where: { id: anggota.rumahId },
      select: { nominalDenda: true },
    });
    const nominalDenda = rumah?.nominalDenda ?? 0;

    // Total active items (for the proportional fine preview) + id→name map.
    const rooms = await this.prisma.ruangan.findMany({
      where: {
        rumahId: anggota.rumahId,
        jenisPiket: { some: { isActive: true } },
      },
      include: { jenisPiket: { where: { isActive: true } } },
    });
    const totalItems = rooms.reduce((sum, r) => sum + r.jenisPiket.length, 0);
    const jenisName = new Map<string, string>();
    const roomJenis = new Map<string, string[]>();
    for (const room of rooms) {
      roomJenis.set(
        room.id,
        room.jenisPiket.map((j) => j.nama),
      );
      for (const j of room.jenisPiket) jenisName.set(j.id, j.nama);
    }
    const resolveJenis = (ids: string[]) =>
      ids.map((id) => jenisName.get(id) ?? id);

    return submissions.map((s) => {
      const workedItems = s.proofs.reduce(
        (sum, p) => sum + p.jenisSelesai.length,
        0,
      );
      const dendaPreview =
        totalItems > 0
          ? Math.round(
            (nominalDenda * Math.max(totalItems - workedItems, 0)) /
            totalItems,
          )
          : 0;
      return {
        id: s.id,
        status: s.status,
        submittedAt: s.submittedAt,
        tanggal: s.jadwal.tanggal,
        anggota: s.anggota,
        proofs: s.proofs.map((p) => {
          const done = new Set(resolveJenis(p.jenisSelesai));
          return {
            ruanganId: p.ruanganId,
            ruanganNama: p.ruangan.nama,
            fotoBefore: p.fotoBefore,
            fotoAfter: p.fotoAfter,
            jenisSelesai: [...done],
            jenisList: roomJenis.get(p.ruanganId) ?? [...done],
          };
        }),
        isMine: s.anggotaId === anggota.id,
        reviewerId: s.reviewerId,
        reviewerName: s.approvals[0]?.reviewer?.nama ?? null,
        isMyTurn: s.reviewerId === anggota.id,
        dendaApprove: dendaPreview, // remaining fine if approved partial
        dendaReject: nominalDenda, // full flat fine if rejected
      };
    });
  }

  async approveSubmission(payload: CurrentUserPayload, submissionId: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    const submission = await this.getSubmissionForReview(
      submissionId,
      anggota.rumahId,
      anggota.id,
    );

    // Approve but still charge the REMAINING denda for unchecked items
    // (partial submission): proportional fine on the unworked items.
    const rumah = await this.prisma.rumah.findUnique({
      where: { id: anggota.rumahId },
    });
    const nominalBase = rumah?.nominalDenda ?? 0;
    const remaining = await this.proportionalDenda(
      anggota.rumahId,
      nominalBase,
      submission.proofs,
    );

    const { denda } = await this.prisma.$transaction(async (tx) => {
      await tx.piketSubmission.update({
        where: { id: submission.id },
        data: { status: 'approved' },
      });
      await tx.piketApproval.create({
        data: {
          submissionId: submission.id,
          reviewerId: anggota.id,
          status: 'approved',
        },
      });
      if (remaining > 0) {
        return {
          denda: await tx.denda.create({
            data: {
              anggotaId: submission.anggotaId,
              submissionId: submission.id,
              nominal: remaining,
              bayarKeAnggotaId: anggota.id,
            },
          }),
        };
      }
      return { denda: null };
    });

    this.logger.log(
      `[PiketService] Submission ${submission.id} disetujui oleh ${anggota.nama}` +
      (denda ? ` (denda sisa ${denda.nominal})` : ''),
    );
    return {
      submission: { id: submission.id, status: 'approved' },
      denda,
    };
  }

  async rejectSubmission(payload: CurrentUserPayload, submissionId: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    const submission = await this.getSubmissionForReview(
      submissionId,
      anggota.rumahId,
      anggota.id,
    );

    const rumah = await this.prisma.rumah.findUnique({
      where: { id: anggota.rumahId },
    });
    const nominal = rumah?.nominalDenda ?? 0; // reject = FULL flat fine

    const { denda } = await this.prisma.$transaction(async (tx) => {
      await tx.piketSubmission.update({
        where: { id: submission.id },
        data: { status: 'rejected' },
      });
      await tx.piketApproval.create({
        data: {
          submissionId: submission.id,
          reviewerId: anggota.id,
          status: 'rejected',
        },
      });
      const created = await tx.denda.create({
        data: {
          anggotaId: submission.anggotaId,
          submissionId: submission.id,
          nominal,
          bayarKeAnggotaId: anggota.id,
        },
      });
      return { denda: created };
    });

    this.logger.log(
      `[PiketService] Submission ${submission.id} ditolak, denda ${denda.id}`,
    );
    return { submission: { id: submission.id, status: 'rejected' }, denda };
  }

  /**
   * Proportional fine: `nominalDenda × (unworkedItems / totalItems)`. An item
   * counts as worked if its jenis was checked on the submission. Rooms with
   * zero checked jenis contribute all their items to the unworked count.
   */
  private async proportionalDenda(
    rumahId: string,
    nominalDenda: number,
    proofs: { jenisSelesai: string[] }[],
  ): Promise<number> {
    const rooms = await this.prisma.ruangan.findMany({
      where: { rumahId, jenisPiket: { some: { isActive: true } } },
      include: {
        jenisPiket: { where: { isActive: true } },
      },
    });
    const totalItems = rooms.reduce((sum, r) => sum + r.jenisPiket.length, 0);
    if (totalItems === 0) return 0;

    const workedItems = proofs.reduce(
      (sum, p) => sum + p.jenisSelesai.length,
      0,
    );
    const unworked = Math.max(totalItems - workedItems, 0);
    return Math.round((nominalDenda * unworked) / totalItems);
  }

  /**
   * Assigned reviewer for a new submission (locked 2026-08-09):
   * - submitter is an ordinary member → reviewer is the PJ (admin).
   * - submitter is the PJ → reviewer is another member, chosen round-robin
   *   (rotating by the count of submissions the PJ has created so far).
   * The sender is never their own reviewer.
   */
  private async assignReviewer(
    rumahId: string,
    anggotaId: string,
  ): Promise<string> {
    const members = await this.prisma.anggota.findMany({
      where: { rumahId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true },
    });
    const pj = members.find((m) => m.role === 'admin');

    if (anggotaId !== pj?.id) {
      // Ordinary member → PJ reviews.
      if (!pj) throw new NotFoundException('Kos belum memiliki PJ.');
      return pj.id;
    }

    // PJ submitted → round-robin among the other (non-PJ) members.
    const others = members.filter((m) => m.role !== 'admin');
    if (others.length === 0) {
      throw new ConflictException(
        'Tidak ada anggota lain untuk memverifikasi piket PJ.',
      );
    }
    const pjSubCount = await this.prisma.piketSubmission.count({
      where: { anggotaId },
    });
    return others[pjSubCount % others.length]!.id;
  }

  private async getSubmissionForReview(
    submissionId: string,
    rumahId: string,
    reviewerId: string,
  ) {
    const submission = await this.prisma.piketSubmission.findUnique({
      where: { id: submissionId },
      include: { jadwal: true, proofs: true },
    });
    if (!submission || submission.jadwal.rumahId !== rumahId) {
      throw new BadRequestException('Pengumpulan tidak ditemukan.');
    }
    if (submission.status !== 'menunggu') {
      throw new ConflictException('Pengumpulan sudah diverifikasi.');
    }
    if (submission.reviewerId !== reviewerId) {
      throw new ForbiddenException(
        'Bukan giliran Anda untuk memverifikasi pengumpulan ini.',
      );
    }
    if (submission.anggotaId === reviewerId) {
      throw new ForbiddenException(
        'Anda tidak dapat memverifikasi pengumpulan sendiri.',
      );
    }
    return submission;
  }
}
