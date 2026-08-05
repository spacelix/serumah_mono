import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@serumah/db/prisma';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RumahScopeService } from '../../common/services/rumah-scope.service';
import { CreateSubmissionDto } from './dto/piket.dto';

@Injectable()
export class PiketService {
  private readonly logger = new Logger(PiketService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RumahScopeService,
  ) {}

  private today(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
        anggota: { select: { id: true, nama: true, kamar: true } },
        submissions: true,
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
    for (const room of ruangan) {
      jenisByRuangan[room.id] = room.jenisPiket.map((j) => ({
        id: j.id,
        nama: j.nama,
      }));
    }

    const existingSubmission = jadwal?.submissions[0] ?? null;

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
      existingSubmission,
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

    // Rooms that must be completed = active rooms. Server validates each.
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

    // Every active room must appear exactly once with both photos + checklist.
    for (const id of activeRoomIds) {
      if (!submittedRoomIds.has(id)) {
        throw new BadRequestException(
          'Semua ruangan wajib dilengkapi (foto sebelum & sesudah).',
        );
      }
    }

    const submission = await this.prisma.$transaction(async (tx) => {
      const created = await tx.piketSubmission.create({
        data: {
          jadwalId: jadwal.id,
          anggotaId: anggota.id,
          status: 'menunggu',
          submittedAt: new Date(),
        },
      });

      for (const proof of dto.proofs) {
        await tx.ruanganProof.create({
          data: {
            submissionId: created.id,
            ruanganId: proof.ruanganId,
            fotoBefore: proof.fotoBeforeUrl,
            fotoAfter: proof.fotoAfterUrl,
            jenisSelesai: proof.jenisSelesai,
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
    return { submission };
  }

  private toDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
