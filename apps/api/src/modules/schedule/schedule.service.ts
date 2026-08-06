import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@serumah/db/prisma';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RumahScopeService } from '../../common/services/rumah-scope.service';
import { WeekendStatusDto } from './dto/schedule.dto';

const PIKET_WEEKDAYS = [1, 3, 5]; // Senin(1), Rabu(3), Jumat(5)
const WEEKEND_HARI: Record<number, 'sabtu' | 'minggu'> = {
  0: 'minggu',
  6: 'sabtu',
};
const FREEZE_HOUR = 20; // Jumat 20:00
const FINE_DEADLINE_HOUR = 20;

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RumahScopeService,
  ) {}

  // ── DATE HELPERS (local, date-only) ─────────────────────────────────
  private toDate(date: Date | string): Date {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  private mondayOf(date: Date): Date {
    const day = date.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    return this.addDays(date, offset);
  }

  private isPiketDay(date: Date): boolean {
    return PIKET_WEEKDAYS.includes(date.getDay());
  }

  private isWeekendDay(date: Date): boolean {
    return date.getDay() === 0 || date.getDay() === 6;
  }

  /** Global 0-based round-robin counter for piket days since a fixed epoch. */
  private weekdayOrdinal(date: Date): number {
    const epoch = new Date(2024, 0, 1); // Monday
    let counter = 0;
    let cursor = this.toDate(epoch);
    const target = this.toDate(date);
    while (cursor <= target) {
      if (this.isPiketDay(cursor)) counter += 1;
      cursor = this.addDays(cursor, 1);
    }
    return counter - 1;
  }

  /** Global 0-based counter of weekend days since a fixed epoch. */
  private weekendOrdinal(date: Date): number {
    const epoch = new Date(2024, 0, 6); // Saturday
    let counter = 0;
    let cursor = this.toDate(epoch);
    const target = this.toDate(date);
    while (cursor <= target) {
      if (this.isWeekendDay(cursor)) counter += 1;
      cursor = this.addDays(cursor, 1);
    }
    return counter - 1;
  }

  private async members(rumahId: string) {
    return this.prisma.anggota.findMany({
      where: { rumahId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── WEEKDAY GENERATION (MONDAY) ─────────────────────────────────────
  private async ensureWeekday(rumahId: string, date: Date): Promise<void> {
    const day = this.toDate(date);
    if (!this.isPiketDay(day)) return;

    const existing = await this.prisma.jadwal.findFirst({
      where: { rumahId, tanggal: day },
    });
    if (existing) return;

    const memberList = await this.members(rumahId);
    if (memberList.length === 0) return;

    const index = this.weekdayOrdinal(day) % memberList.length;
    const member = memberList[index];
    const rooms = await this.activeRoomNames(rumahId);

    await this.prisma.jadwal.create({
      data: {
        rumahId,
        tanggal: day,
        anggotaId: member.id,
        ruangan: rooms,
      },
    });
    this.logger.log(
      `[ScheduleService] Jadwal ${day.toISOString()} → ${member.id}`,
    );
  }

  private async ensureWeekdayWeek(
    rumahId: string,
    monday: Date,
  ): Promise<void> {
    for (let offset = 0; offset < 7; offset += 1) {
      const day = this.addDays(monday, offset);
      if (this.isPiketDay(day)) await this.ensureWeekday(rumahId, day);
    }
  }

  private async ensureWeekend(
    rumahId: string,
    weekendDay: Date,
  ): Promise<void> {
    const day = this.toDate(weekendDay);
    if (!this.isWeekendDay(day)) return;

    const monday = this.mondayOf(day);
    const hari = WEEKEND_HARI[day.getDay()];

    const existing = await this.prisma.jadwal.findFirst({
      where: { rumahId, tanggal: day },
    });
    if (existing) return;

    // This week's di_kos; fall back to last week's status when none recorded.
    let rows = await this.prisma.weekendStatus.findMany({
      where: { mingguMulai: monday, hari },
      select: { anggotaId: true },
    });
    if (rows.length === 0) {
      const lastMonday = this.addDays(monday, -7);
      rows = await this.prisma.weekendStatus.findMany({
        where: { mingguMulai: lastMonday, hari },
        select: { anggotaId: true },
      });
    }

    const diKosIds = rows.map((r) => r.anggotaId);
    const diKosMembers = await this.prisma.anggota.findMany({
      where: { rumahId, id: { in: diKosIds } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (diKosMembers.length === 0) return; // Free day (no fine)

    const index = this.weekendOrdinal(day) % diKosMembers.length;
    const member = diKosMembers[index];
    const rooms = await this.activeRoomNames(rumahId);

    await this.prisma.jadwal.create({
      data: {
        rumahId,
        tanggal: day,
        anggotaId: member.id,
        ruangan: rooms,
      },
    });
    this.logger.log(
      `[ScheduleService] Weekend ${day.toISOString()} → ${member.id}`,
    );
  }

  private async activeRoomNames(rumahId: string): Promise<string[]> {
    const rooms = await this.prisma.ruangan.findMany({
      where: { rumahId, jenisPiket: { some: { isActive: true } } },
      orderBy: { urutan: 'asc' },
      select: { nama: true },
    });
    return rooms.map((r) => r.nama);
  }

  // ── PUBLIC API ──────────────────────────────────────────────────────
  async getWeek(payload: CurrentUserPayload, mondayRaw?: string) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) return [];

    const monday = mondayRaw
      ? this.toDate(mondayRaw)
      : this.mondayOf(new Date());
    const sunday = this.addDays(monday, 6);

    const jadwal = await this.prisma.jadwal.findMany({
      where: {
        rumahId: anggota.rumahId,
        tanggal: { gte: monday, lte: sunday },
      },
      orderBy: { tanggal: 'asc' },
      include: {
        anggota: { select: { id: true, nama: true, kamar: true } },
        submissions: { select: { id: true, status: true, anggotaId: true } },
      },
    });

    return jadwal.map((j) => ({
      id: j.id,
      tanggal: j.tanggal,
      anggota: j.anggota,
      ruangan: j.ruangan,
      submission: j.submissions[0] ?? null,
    }));
  }

  async generateWeekday(payload: CurrentUserPayload) {
    const anggota = await this.requirePj(payload);
    const monday = this.addDays(this.mondayOf(new Date()), 7);
    await this.ensureWeekdayWeek(anggota.rumahId!, monday);
    return { message: 'Jadwal pekan depan telah dibuat.' };
  }

  async generateWeekend(payload: CurrentUserPayload) {
    const anggota = await this.requirePj(payload);
    const monday = this.mondayOf(new Date());
    for (const offset of [5, 6]) {
      const day = this.addDays(monday, offset);
      if (day >= this.toDate(new Date())) {
        await this.ensureWeekend(anggota.rumahId!, day);
      }
    }
    return { message: 'Jadwal akhir pekan telah dibuat.' };
  }

  async setWeekendStatus(payload: CurrentUserPayload, dto: WeekendStatusDto) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }

    const monday = this.mondayOf(new Date());
    this.assertNotFrozen(monday);

    await this.prisma.weekendStatus.upsert({
      where: {
        anggotaId_mingguMulai_hari: {
          anggotaId: anggota.id,
          mingguMulai: monday,
          hari: dto.hari,
        },
      },
      update: { status: dto.status },
      create: {
        anggotaId: anggota.id,
        mingguMulai: monday,
        hari: dto.hari,
        status: dto.status,
      },
    });

    this.logger.log(
      `[ScheduleService] ${anggota.nama} ${dto.hari} → ${dto.status}`,
    );
    return { hari: dto.hari, status: dto.status };
  }

  private assertNotFrozen(monday: Date): void {
    const freezeAt = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + 4, // Jumat
      FREEZE_HOUR,
      0,
      0,
    );
    if (new Date() > freezeAt) {
      throw new ForbiddenException(
        'Status akhir pekan telah dibekukan (Jumat 20:00).',
      );
    }
  }

  // ── AUTO-FINE ───────────────────────────────────────────────────────
  /**
   * Daily 22:00. Fines ANY scheduled day (weekday or weekend) that has no
   * submission — off days (Sel/Kamis) have no Jadwal so they are naturally
   * skipped by autoFineForRumah.
   */
  @Cron(CronExpression.EVERY_DAY_AT_10PM)
  async runAutoFineCron(): Promise<void> {
    const today = new Date();
    await this.autoFineProcess(today);
  }

  /** Manual guarded endpoint: runs the fine pass for a specific date. */
  async runAutoFine(payload: CurrentUserPayload, rawDate?: string) {
    const anggota = await this.requirePj(payload);
    const target = rawDate ? this.toDate(rawDate) : this.toDate(new Date());
    const fined = await this.autoFineForRumah(anggota.rumahId!, target);
    return { fined };
  }

  /** Manual guarded endpoint: freezes this week's weekend roster in place. */
  async runWeekendFreeze(payload: CurrentUserPayload) {
    const anggota = await this.requirePj(payload);
    const monday = this.mondayOf(new Date());
    for (const offset of [5, 6]) {
      const day = this.addDays(monday, offset);
      await this.ensureWeekend(anggota.rumahId!, day);
    }
    return { message: 'Jadwal akhir pekan telah dibekukan.' };
  }

  private async autoFineProcess(date: Date): Promise<number> {
    const rumahs = await this.prisma.rumah.findMany({ select: { id: true } });
    let total = 0;
    for (const rumah of rumahs) {
      total += await this.autoFineForRumah(rumah.id, date);
    }
    return total;
  }

  /**
   * Weekly pre-generation (Decision 5B): ensure next week's weekday roster for
   * every rumah. Runs Saturday 06:00 server time. Idempotent via ensureWeekday.
   */
  @Cron('0 6 * * 6')
  async pregenerateWeek(): Promise<void> {
    const monday = this.addDays(this.mondayOf(new Date()), 7);
    const rumahs = await this.prisma.rumah.findMany({ select: { id: true } });
    for (const rumah of rumahs) {
      await this.ensureWeekdayWeek(rumah.id, monday);
    }
    this.logger.log(
      `[ScheduleService] Pra-generasi jadwal pekan ${monday.toISOString()}`,
    );
  }

  /**
   * Freeze weekend roster Friday 20:00 (per spec). After statuses are frozen
   * the weekend Jadwal for Sat+Sun is generated for every rumah.
   */
  @Cron('0 20 * * 5')
  async freezeWeekendCron(): Promise<void> {
    const monday = this.mondayOf(new Date());
    const rumahs = await this.prisma.rumah.findMany({ select: { id: true } });
    for (const rumah of rumahs) {
      for (const offset of [5, 6]) {
        await this.ensureWeekend(rumah.id, this.addDays(monday, offset));
      }
    }
    this.logger.log(
      `[ScheduleService] Jadwal akhir pekan dibekukan ${monday.toISOString()}`,
    );
  }

  private async autoFineForRumah(rumahId: string, date: Date): Promise<number> {
    const jadwal = await this.prisma.jadwal.findFirst({
      where: { rumahId, tanggal: date },
      include: { submissions: true },
    });
    if (!jadwal) return 0;

    if (jadwal.submissions.length > 0) return 0; // already handled

    if (new Date() <= this.deadline(date)) return 0; // still on time

    const rumah = await this.prisma.rumah.findUnique({
      where: { id: rumahId },
    });
    const nominal = rumah?.nominalDenda ?? 0;

    const created = await this.prisma.piketSubmission.create({
      data: {
        jadwalId: jadwal.id,
        anggotaId: jadwal.anggotaId,
        status: 'bolong',
        submittedAt: new Date(),
      },
    });

    if (nominal > 0) {
      await this.prisma.denda.create({
        data: {
          anggotaId: jadwal.anggotaId,
          submissionId: created.id,
          nominal,
        },
      });
    }

    this.logger.log(
      `[ScheduleService] Auto-fine ${created.id} sebesar ${nominal}`,
    );
    return 1;
  }

  private deadline(date: Date): Date {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      FINE_DEADLINE_HOUR,
      0,
      0,
    );
  }

  private async requirePj(payload: CurrentUserPayload) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }
    await this.scope.requirePj(payload.userId, anggota.rumahId);
    return anggota;
  }
}
