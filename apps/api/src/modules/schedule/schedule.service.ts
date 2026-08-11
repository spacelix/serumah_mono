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
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CacheService } from '../redis/cache.service';
import { WeekendStatusDto } from './dto/schedule.dto';

const PIKET_WEEKDAYS = [1, 3, 5]; // Senin(1), Rabu(3), Jumat(5)
const WEEKEND_HARI: Record<number, 'sabtu' | 'minggu'> = {
  0: 'minggu',
  6: 'sabtu',
};
const FREEZE_HOUR = 20; // Jumat 20:00 WIB
const FINE_DEADLINE_HOUR = 20; // 20:00 WIB
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta is UTC+7, no DST

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RumahScopeService,
    private readonly cache: CacheService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) { }

  // ── DATE HELPERS (UTC-based so @db.Date matches Postgres `date` columns) ──
  // Prisma stores `@db.Date` as a date string derived from the UTC components
  // of the JS Date. Building dates via `new Date(y, m, d)` uses the server's
  // LOCAL timezone (e.g. WIB), which shifts the stored day by one. All calendar
  // math here therefore runs in UTC; "today" is resolved to UTC-midnight.
  private toDate(date: Date | string): Date {
    // Resolve the WIB calendar day of the input, then canonicalize it as
    // UTC-midnight so @db.Date storage, comparisons, and getUTCDay() all agree.
    const d = new Date(date);
    const wib = new Date(d.getTime() + WIB_OFFSET_MS);
    return new Date(
      Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()),
    );
  }

  private addDays(date: Date, days: number): Date {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + days,
      ),
    );
  }

  private mondayOf(date: Date): Date {
    const day = date.getUTCDay();
    const offset = day === 0 ? -6 : 1 - day;
    return this.addDays(date, offset);
  }

  private isPiketDay(date: Date): boolean {
    return PIKET_WEEKDAYS.includes(date.getUTCDay());
  }

  private isWeekendDay(date: Date): boolean {
    return date.getUTCDay() === 0 || date.getUTCDay() === 6;
  }

  /** Global 0-based round-robin counter for piket days since a fixed epoch. */
  private weekdayOrdinal(date: Date): number {
    const epoch = this.toDate(new Date(Date.UTC(2024, 0, 1))); // Monday
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
    const epoch = this.toDate(new Date(Date.UTC(2024, 0, 6))); // Saturday
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

  /**
   * IDs of members who hold a WEEKEND Jadwal row (Sabtu/Minggu) in the week
   * whose Monday is `monday`. These members are free from weekday piket that
   * same week (locked decision 2026-08-08).
   */
  private async weekendAssigneeIds(
    rumahId: string,
    monday: Date,
  ): Promise<string[]> {
    const rows = await this.prisma.jadwal.findMany({
      where: {
        rumahId,
        tanggal: { gte: monday, lte: this.addDays(monday, 6) },
      },
      select: { anggotaId: true, tanggal: true },
    });
    return rows
      .filter((r) => this.isWeekendDay(r.tanggal))
      .map((r) => r.anggotaId);
  }

  // ── WEEKDAY GENERATION (MONDAY) ─────────────────────────────────────
  private async ensureWeekday(rumahId: string, date: Date): Promise<boolean> {
    const day = this.toDate(date);
    if (!this.isPiketDay(day)) return false;

    const existing = await this.prisma.jadwal.findFirst({
      where: { rumahId, tanggal: day },
    });
    if (existing) return false;

    const memberList = await this.members(rumahId);
    if (memberList.length === 0) return false;

    const monday = this.mondayOf(day);

    // Members already holding a weekend piket this week are free from weekday.
    const weekendIds = await this.weekendAssigneeIds(rumahId, monday);

    // Members who already hold ANOTHER weekday row this week must not get a
    // second weekday — guarantees no one piket twice in one week, and keeps
    // the assignment stable when the pool shrinks (e.g. after a weekend
    // assignee is excluded by reconcileWeekdayForWeekend).
    const weekRows = await this.prisma.jadwal.findMany({
      where: {
        rumahId,
        tanggal: { gte: monday, lte: this.addDays(monday, 6) },
      },
      select: { tanggal: true, anggotaId: true },
    });
    const alreadyAssigned = new Set(
      weekRows
        .filter(
          (r) =>
            this.isPiketDay(r.tanggal) && r.tanggal.getTime() !== day.getTime(),
        )
        .map((r) => r.anggotaId),
    );

    // Prefer members who don't already hold a weekday row this week (avoids
    // someone piket twice), but if the pool would be empty (fewer members than
    // piket days, e.g. a 2-member rumah) fall back to all non-weekend members
    // so the day still gets scheduled.
    const excludeAssigned = memberList.filter(
      (m) => !weekendIds.includes(m.id) && !alreadyAssigned.has(m.id),
    );
    const pool =
      excludeAssigned.length > 0
        ? excludeAssigned
        : memberList.filter((m) => !weekendIds.includes(m.id));
    if (pool.length === 0) return false;

    const index = this.weekdayOrdinal(day) % pool.length;
    const member = pool[index];
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
    return true;
  }

  private async ensureWeekdayWeek(
    rumahId: string,
    monday: Date,
  ): Promise<number> {
    let count = 0;
    for (let offset = 0; offset < 7; offset += 1) {
      const day = this.addDays(monday, offset);
      if (this.isPiketDay(day)) {
        if (await this.ensureWeekday(rumahId, day)) count += 1;
      }
    }
    return count;
  }

  private async ensureWeekend(
    rumahId: string,
    weekendDay: Date,
  ): Promise<boolean> {
    const day = this.toDate(weekendDay);
    if (!this.isWeekendDay(day)) return false;

    const monday = this.mondayOf(day);
    const hari = WEEKEND_HARI[day.getUTCDay()];

    const existing = await this.prisma.jadwal.findFirst({
      where: { rumahId, tanggal: day },
    });
    if (existing) return false;

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

    if (diKosMembers.length === 0) return false; // Free day (no fine)

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
    return true;
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
        anggota: { select: { id: true, nama: true } },
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
    const count = await this.ensureWeekdayWeek(anggota.rumahId!, monday);
    await this.cache.invalidateScope(`dashboard:${anggota.rumahId}`);
    return { message: 'Jadwal pekan depan telah dibuat.', count };
  }

  /**
   * First-time generation (admin): backfills the REST of the current week
   * from today until Sunday — weekday piket days + weekend (from Di kos
   * status). Next week is handled by the regular cron (`pregenerateWeek`
   * Saturday + `freezeWeekendCron` Friday), so we never double-write here.
   */
  async generateRestOfWeek(payload: CurrentUserPayload) {
    const anggota = await this.requirePj(payload);
    const today = this.toDate(new Date());
    const sunday = this.addDays(this.mondayOf(today), 6);

    let count = 0;
    // Weekend first (so weekend piket assignees are excluded from weekday
    // generation below), then weekday piket days.
    for (
      let cursor = today;
      cursor <= sunday;
      cursor = this.addDays(cursor, 1)
    ) {
      if (this.isWeekendDay(cursor)) {
        if (await this.ensureWeekend(anggota.rumahId!, cursor)) count += 1;
      }
    }
    for (
      let cursor = today;
      cursor <= sunday;
      cursor = this.addDays(cursor, 1)
    ) {
      if (this.isPiketDay(cursor)) {
        if (await this.ensureWeekday(anggota.rumahId!, cursor)) count += 1;
      }
    }
    await this.cache.invalidateScope(`dashboard:${anggota.rumahId}`);
    return { message: 'Jadwal pekan ini telah dibuat.', count };
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
    await this.cache.invalidateScope(`dashboard:${anggota.rumahId}`);
    return { message: 'Jadwal akhir pekan telah dibuat.' };
  }

  /**
   * Refresh only the `ruangan[]` snapshot of future Jadwal rows (days after
   * today) so that only rooms with an active jenis piket appear. Member
   * assignment (round-robin) is preserved — day rows already in the past are
   * left untouched. Triggered from Kelola Rumah after a jenis piket is added.
   */
  async refreshFutureRooms(payload: CurrentUserPayload) {
    const anggota = await this.requirePj(payload);
    const today = this.toDate(new Date());

    const futureRows = await this.prisma.jadwal.findMany({
      where: { rumahId: anggota.rumahId!, tanggal: { gt: today } },
      select: { id: true },
    });
    if (futureRows.length === 0) return { updated: 0 };

    const roomNames = await this.activeRoomNames(anggota.rumahId!);
    await this.prisma.jadwal.updateMany({
      where: { id: { in: futureRows.map((j) => j.id) } },
      data: { ruangan: roomNames },
    });
    this.logger.log(
      `[ScheduleService] Refresh ruangan ${futureRows.length} jadwal masa depan → ${roomNames.length} ruang`,
    );
    await this.cache.invalidateScope(`dashboard:${anggota.rumahId}`);
    return { updated: futureRows.length };
  }

  async setWeekendStatus(payload: CurrentUserPayload, dto: WeekendStatusDto) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      throw new BadRequestException('Bergabunglah ke kos terlebih dahulu.');
    }

    const monday = this.mondayOf(new Date());
    this.assertNotFrozen(monday);

    // 1 pilihan berlaku untuk seluruh weekend: set hari sabtu + minggu dengan
    // status yang sama (locked 2026-08-11).
    const hariList = ['sabtu', 'minggu'] as const;
    for (const hari of hariList) {
      await this.prisma.weekendStatus.upsert({
        where: {
          anggotaId_mingguMulai_hari: {
            anggotaId: anggota.id,
            mingguMulai: monday,
            hari,
          },
        },
        update: { status: dto.status },
        create: {
          anggotaId: anggota.id,
          mingguMulai: monday,
          hari,
          status: dto.status,
        },
      });
    }

    if (dto.status === 'di_kos') {
      // Locked decision (2026-08-08): choosing Di kos immediately generates
      // that weekend day's Jadwal so the UI shows who piket right away.
      for (const offset of [5, 6]) {
        await this.ensureWeekend(anggota.rumahId, this.addDays(monday, offset));
      }
    }

    // Locked decision (2026-08-08): members assigned a weekend piket this week
    // are free from weekday piket the same week — regenerate any affected
    // weekday rows so the weekend assignee is swapped out of the round-robin.
    await this.reconcileWeekdayForWeekend(anggota.rumahId, monday);

    this.logger.log(
      `[ScheduleService] ${anggota.nama} weekend → ${dto.status}`,
    );
    await this.cache.invalidateScope(`dashboard:${anggota.rumahId}`);
    // Notifikasi ke semua anggota lain (kecuali pengubah status).
    await this.notifications.notifyWeekendStatus(
      anggota.rumahId,
      anggota.nama,
      'sabtu',
      dto.status,
    );
    this.realtime.emitToRumah(anggota.rumahId, 'schedule:updated', {
      status: dto.status,
    });
    return { status: dto.status };
  }

  /**
   * After a weekend piket is assigned (Di kos), the assignee must not appear on
   * weekday piket that same week. Regenerate this week's weekday rows, picking
   * from the pool that EXCLUDES every member who holds a weekend Jadwal row.
   */
  private async reconcileWeekdayForWeekend(
    rumahId: string,
    monday: Date,
  ): Promise<void> {
    const weekendAssignees = await this.weekendAssigneeIds(rumahId, monday);
    if (weekendAssignees.length === 0) return;

    const weekDays = await this.prisma.jadwal.findMany({
      where: {
        rumahId,
        tanggal: { gte: monday, lte: this.addDays(monday, 6) },
      },
      select: { id: true, tanggal: true, anggotaId: true },
    });

    let regenerated = 0;
    for (const row of weekDays) {
      if (!this.isPiketDay(row.tanggal)) continue;
      if (!weekendAssignees.includes(row.anggotaId)) continue;
      await this.prisma.jadwal.delete({ where: { id: row.id } });
      if (await this.ensureWeekday(rumahId, row.tanggal)) regenerated += 1;
    }

    if (regenerated > 0) {
      this.logger.log(
        `[ScheduleService] Reconcile weekday (${regenerated}) setelah piket weekend`,
      );
    }
  }

  private assertNotFrozen(monday: Date): void {
    // Freeze = Friday 20:00 WIB. monday is UTC-midnight; add 4 days then shift
    // the wall-clock 20:00 WIB to an absolute instant (UTC+7, no DST).
    const fridayUtc = this.addDays(monday, 4);
    const freezeAt = new Date(
      fridayUtc.getTime() + FREEZE_HOUR * 60 * 60 * 1000 - WIB_OFFSET_MS,
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
   * Daily self-heal (2026-08-10): ensure the current week's weekday roster
   * exists for today → Sunday (never past days). Idempotent via ensureWeekday,
   * so a missed Saturday pregenerate (server down) is caught up the next
   * morning — Monday no longer requires a manual "Generate Jadwal".
   */
  @Cron('0 6 * * *')
  async selfHealWeek(): Promise<void> {
    const today = this.toDate(new Date());
    const sunday = this.addDays(this.mondayOf(today), 6);
    const rumahs = await this.prisma.rumah.findMany({ select: { id: true } });
    let count = 0;
    for (const rumah of rumahs) {
      for (
        let cursor = today;
        cursor <= sunday;
        cursor = this.addDays(cursor, 1)
      ) {
        if (this.isPiketDay(cursor)) {
          if (await this.ensureWeekday(rumah.id, cursor)) count += 1;
        }
      }
    }
    this.logger.log(
      `[ScheduleService] Self-heal jadwal pekan berjalan ${today.toISOString()} (${count} baris baru)`,
    );
  }

  /**
   * Freeze weekend roster Friday 20:00 (per spec). After statuses are frozen
   * the weekend Jadwal for Sat+Sun is generated for every rumah. Anggota yang
   * belum konfirmasi status (Sabtu & Minggu) dapat notif "bertanggung jawab".
   */
  @Cron('0 20 * * 5')
  async freezeWeekendCron(): Promise<void> {
    const monday = this.mondayOf(new Date());
    const rumahs = await this.prisma.rumah.findMany({ select: { id: true } });
    for (const rumah of rumahs) {
      for (const offset of [5, 6]) {
        await this.ensureWeekend(rumah.id, this.addDays(monday, offset));
      }

      // Anggota yang belum pilih Di kos/Pulang sama sekali (dua hari belum
      // tercatat) → notif tanggung jawab penuh.
      const members = await this.prisma.anggota.findMany({
        where: { rumahId: rumah.id },
        select: { id: true },
      });
      const chosenRows = await this.prisma.weekendStatus.findMany({
        where: { mingguMulai: monday, anggotaId: { in: members.map((m) => m.id) } },
        select: { anggotaId: true },
      });
      const chosen = new Set(chosenRows.map((r) => r.anggotaId));
      for (const m of members) {
        if (!chosen.has(m.id)) {
          await this.notifications.notifyWeekendMissed(m.id);
        }
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
    // Fine deadline = 20:00 WIB on the scheduled day. date is UTC-midnight;
    // shift wall-clock 20:00 WIB to an absolute instant (UTC+7, no DST).
    return new Date(
      date.getTime() + FINE_DEADLINE_HOUR * 60 * 60 * 1000 - WIB_OFFSET_MS,
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
