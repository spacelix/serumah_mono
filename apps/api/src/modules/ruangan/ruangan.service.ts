import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@serumah/db/prisma';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RumahScopeService } from '../../common/services/rumah-scope.service';
import {
  CreateJenisPiketDto,
  CreateRuanganDto,
  ReorderRuanganDto,
  UpdateJenisPiketDto,
  UpdateRuanganDto,
} from './dto/ruangan.dto';

@Injectable()
export class RuanganService {
  private readonly logger = new Logger(RuanganService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RumahScopeService,
  ) {}

  async listRuangan(payload: CurrentUserPayload) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      return [];
    }
    return this.prisma.ruangan.findMany({
      where: { rumahId: anggota.rumahId },
      orderBy: { urutan: 'asc' },
      include: {
        jenisPiket: {
          orderBy: { id: 'asc' },
        },
      },
    });
  }

  async createRuangan(payload: CurrentUserPayload, dto: CreateRuanganDto) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new ConflictException('Bergabunglah ke kos terlebih dahulu.');
    }
    await this.scope.requirePj(payload.userId, anggota.rumahId);

    const urutan = await this.nextUrutan(anggota.rumahId);
    const ruangan = await this.prisma.ruangan.create({
      data: {
        rumahId: anggota.rumahId,
        nama: dto.nama,
        urutan,
      },
    });

    this.logger.log(`[RuanganService] Ruangan dibuat: ${ruangan.id}`);
    return ruangan;
  }

  async updateRuangan(
    payload: CurrentUserPayload,
    ruanganId: string,
    dto: UpdateRuanganDto,
  ) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    const ruangan = await this.getRuangan(ruanganId, anggota.rumahId!);
    await this.scope.requirePj(payload.userId, anggota.rumahId!);

    return this.prisma.ruangan.update({
      where: { id: ruangan.id },
      data: { nama: dto.nama },
    });
  }

  async deleteRuangan(payload: CurrentUserPayload, ruanganId: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    const ruangan = await this.getRuangan(ruanganId, anggota.rumahId!);
    await this.scope.requirePj(payload.userId, anggota.rumahId!);

    await this.prisma.ruangan.delete({ where: { id: ruangan.id } });
    this.logger.log(`[RuanganService] Ruangan dihapus: ${ruangan.id}`);
    return { ok: true };
  }

  async reorderRuangan(payload: CurrentUserPayload, dto: ReorderRuanganDto) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    await this.scope.requirePj(payload.userId, anggota.rumahId!);

    const ruangans = await this.prisma.ruangan.findMany({
      where: { rumahId: anggota.rumahId! },
      select: { id: true },
    });
    const owned = new Set(ruangans.map((r) => r.id));
    if (dto.urutan.length !== owned.size) {
      throw new ConflictException(
        'Urutan ruangan tidak sesuai dengan daftar ruangan kos ini.',
      );
    }
    for (const id of dto.urutan) {
      if (!owned.has(id)) {
        throw new ConflictException(
          'Urutan ruangan memuat ruangan di luar kos ini.',
        );
      }
    }

    await this.prisma.$transaction(
      dto.urutan.map((id, index) =>
        this.prisma.ruangan.update({
          where: { id },
          data: { urutan: index },
        }),
      ),
    );

    this.logger.log(
      `[RuanganService] Urutan ruangan diperbarui (${dto.urutan.length} item).`,
    );
    return { ok: true };
  }

  async listJenisPiket(payload: CurrentUserPayload, ruanganId: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    const ruangan = await this.getRuangan(ruanganId, anggota.rumahId!);
    return this.prisma.jenisPiket.findMany({
      where: { ruanganId: ruangan.id },
      orderBy: { id: 'asc' },
    });
  }

  async createJenisPiket(
    payload: CurrentUserPayload,
    ruanganId: string,
    dto: CreateJenisPiketDto,
  ) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    const ruangan = await this.getRuangan(ruanganId, anggota.rumahId!);
    await this.scope.requirePj(payload.userId, anggota.rumahId!);

    const jenis = await this.prisma.jenisPiket.create({
      data: { ruanganId: ruangan.id, nama: dto.nama },
    });
    this.logger.log(`[RuanganService] Jenis piket dibuat: ${jenis.id}`);
    return jenis;
  }

  async updateJenisPiket(
    payload: CurrentUserPayload,
    jenisId: string,
    dto: UpdateJenisPiketDto,
  ) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    const jenis = await this.getJenis(jenisId, anggota.rumahId!);
    await this.scope.requirePj(payload.userId, anggota.rumahId!);

    return this.prisma.jenisPiket.update({
      where: { id: jenis.id },
      data: {
        nama: dto.nama,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteJenisPiket(payload: CurrentUserPayload, jenisId: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    const jenis = await this.getJenis(jenisId, anggota.rumahId!);
    await this.scope.requirePj(payload.userId, anggota.rumahId!);

    await this.prisma.jenisPiket.delete({ where: { id: jenis.id } });
    this.logger.log(`[RuanganService] Jenis piket dihapus: ${jenis.id}`);
    return { ok: true };
  }

  private async getRuangan(ruanganId: string, rumahId: string) {
    const ruangan = await this.prisma.ruangan.findUnique({
      where: { id: ruanganId },
    });
    if (!ruangan || ruangan.rumahId !== rumahId) {
      throw new NotFoundException('Ruangan tidak ditemukan.');
    }
    return ruangan;
  }

  private async getJenis(jenisId: string, rumahId: string) {
    const jenis = await this.prisma.jenisPiket.findUnique({
      where: { id: jenisId },
      include: { ruangan: true },
    });
    if (!jenis || jenis.ruangan.rumahId !== rumahId) {
      throw new NotFoundException('Jenis piket tidak ditemukan.');
    }
    return jenis;
  }

  private async nextUrutan(rumahId: string): Promise<number> {
    const last = await this.prisma.ruangan.findFirst({
      where: { rumahId },
      orderBy: { urutan: 'desc' },
      select: { urutan: true },
    });
    return last ? last.urutan + 1 : 0;
  }
}
