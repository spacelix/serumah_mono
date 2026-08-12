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

  /**
   * Generate jadwal weekend untuk SATU minggu (Sabtu + Minggu sekaligus).
   * Semua member berstatus di_kos ikut piket, dibagi MERATA 2 hari dengan
   * rotasi per minggu (weekendOrdinal) supaya adil lintas minggu:
   *   - 2 orang → Sabtu 1, Minggu 1
   *   - 3 orang → Sabtu 2, Minggu 1
   *   - dst.
   * Idempoten: member yang sudah memegang jadwal weekend minggu itu di-skip
   * (no back-to-back), jadwal yang sudah ada per (tanggal, anggota) tidak
   * digandakan.
   */
  /**
   * Atur jadwal weekend (locked 2026-08-12):
   * 1. Hapus jadwal weekend tanpa submission (re-distribute penuh).
   * 2. Urutkan di_kos: pemilik slot weekday minggu ini dulu (A=Rabu → Sabtu,
   *    B=Jumat → Minggu), lalu non-owner (PJ, C) — berdasar round-robin
   *    `weekdayOrdinal(day) % n` yang deterministik.
   * 3. Bergantian Sabtu/Minggu — beberapa orang boleh TUMPUK di hari sama.
   */
  private async ensureWeekendWeek(rumahId: string, monday: Date): Promise<number> {
    const sabtu = this.addDays(monday, 5);
    const minggu = this.addDays(monday, 6);

    // This week's di_kos (scoped ke rumah ini via relasi anggota); fall back
    // to last week's status when none recorded.
    let rows = await this.prisma.weekendStatus.findMany({
      where: {
        mingguMulai: monday,
        status: 'di_kos',
        anggota: { rumahId },
      },
      select: { anggotaId: true },
    });
    if (rows.length === 0) {
      const lastMonday = this.addDays(monday, -7);
      rows = await this.prisma.weekendStatus.findMany({
        where: {
          mingguMulai: lastMonday,
          status: 'di_kos',
          anggota: { rumahId },
        },
        select: { anggotaId: true },
      });
    }
    if (rows.length === 0) return 0;

    const diKosIds = [...new Set(rows.map((r) => r.anggotaId))];
    const diKosMembers = await this.prisma.anggota.findMany({
      where: { rumahId, id: { in: diKosIds } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (diKosMembers.length === 0) return 0;

    // Hapus jadwal weekend tanpa submission (re-distribute penuh).
    const existingRows = await this.prisma.jadwal.findMany({
      where: { rumahId, tanggal: { gte: sabtu, lte: minggu } },
      select: { id: true, submissions: { select: { id: true } } },
    });
    const deletable = existingRows.filter((r) => r.submissions.length === 0);
    if (deletable.length > 0) {
      await this.prisma.jadwal.deleteMany({
        where: { id: { in: deletable.map((r) => r.id) } },
      });
    }

    // Pemilik weekday minggu ini berdasar round-robin: untuk tiap hari piket,
    // pemilik = weekdayOrdinal(day) % n. Ini deterministik — tidak bergantung
    // pada row yang tersisa (yang mungkin sudah dihapus saat di_kos).
    const allMembers = await this.members(rumahId);
    const n = allMembers.length;
    const ownerByDay = new Map<number, string>(); // timestamp → anggotaId
    for (let offset = 0; offset < 7; offset += 1) {
      const day = this.addDays(monday, offset);
      if (!this.isPiketDay(day)) continue;
      const index = this.weekdayOrdinal(day) % n;
      ownerByDay.set(day.getTime(), allMembers[index]!.id);
    }

    // Urut: pemilik weekday dulu (by day), lalu non-owner (by createdAt).
    const ordered = [...diKosMembers].sort((a, b) => {
      const dayA = this.weekdayOwnerDay(ownerByDay, a.id);
      const dayB = this.weekdayOwnerDay(ownerByDay, b.id);
      if (dayA !== null && dayB !== null) return dayA - dayB;
      if (dayA !== null) return -1;
      if (dayB !== null) return 1;
      return a.id.localeCompare(b.id);
    });

    // Assign: pemilik hari piket pertama minggu ini (Rabu) → Sabtu, kedua
    // (Jumat) → Minggu. Posisi dihitung GLOBAL (urutan hari piket minggu ini),
    // bukan urutan dalam daftar di_kos — jadi B (Jumat, posisi 2) selalu Minggu
    // meski A tidak ikut di_kos. Non-owner bergantian mulai Sabtu.
    const piketDays: number[] = []; // timestamp hari piket minggu ini, urut
    for (let offset = 0; offset < 7; offset += 1) {
      const day = this.addDays(monday, offset);
      if (this.isPiketDay(day)) piketDays.push(day.getTime());
    }
    const sabtuMembers: { id: string }[] = [];
    const mingguMembers: { id: string }[] = [];
    let nonOwnerTurn = 0; // 0=Sabtu, 1=Minggu
    for (const m of ordered) {
      const day = this.weekdayOwnerDay(ownerByDay, m.id);
      if (day !== null) {
        // posisi 1-based di piketDays → ganjil Sabtu, genap Minggu
        const pos = piketDays.indexOf(day) + 1;
        if (pos % 2 === 1) sabtuMembers.push(m);
        else mingguMembers.push(m);
      } else {
        nonOwnerTurn += 1;
        if (nonOwnerTurn % 2 === 1) sabtuMembers.push(m);
        else mingguMembers.push(m);
      }
    }

    const rooms = await this.activeRoomNames(rumahId);
    let created = 0;
    const assign = async (day: Date, members: { id: string }[]) => {
      for (const m of members) {
        const exists = await this.prisma.jadwal.findFirst({
          where: { rumahId, tanggal: day, anggotaId: m.id },
        });
        if (exists) continue;
        await this.prisma.jadwal.create({
          data: { rumahId, tanggal: day, anggotaId: m.id, ruangan: rooms },
        });
        created += 1;
        this.logger.log(
          `[ScheduleService] Weekend ${day.toISOString()} → ${m.id}`,
        );
      }
    };
    await assign(sabtu, sabtuMembers);
    await assign(minggu, mingguMembers);
    return created;
  }

  /** Timestamp hari piket minggu ini yang menjadi milik anggotaId, atau null. */
  private weekdayOwnerDay(
    ownerByDay: Map<number, string>,
    anggotaId: string,
  ): number | null {
    for (const [ts, owner] of ownerByDay) {
      if (owner === anggotaId) return ts;
    }
    return null;
  }

  private async activeRoomNames(rumahId: string): Promise<string[]> {
    const rooms = await this.prisma.ruangan.findMany({
      where: { rumahId, jenisPiket: { some: { isActive: true } } },
      orderBy: { urutan: 'asc' },
      select: { nama: true },
    });
    return rooms.map((r) => r.nama);
  }

  /**
   * Hapus semua baris Jadwal weekend (Sabtu+Minggu) milik satu anggota untuk
   * minggu yang dimaksud. Dipakai saat anggota mengubah status jadi `pulang`.
   */
  private async deleteMemberWeekendJadwal(
    rumahId: string,
    anggotaId: string,
    monday: Date,
  ): Promise<number> {
    const sabtu = this.addDays(monday, 5);
    const minggu = this.addDays(monday, 6);
    const result = await this.prisma.jadwal.deleteMany({
      where: {
        rumahId,
        anggotaId,
        tanggal: { gte: sabtu, lte: minggu },
      },
    });
    if (result.count > 0) {
      this.logger.log(
        `[ScheduleService] Hapus weekend jadwal anggota ${anggotaId}: ${result.count} baris`,
      );
    }
    return result.count;
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
   * Generate jadwal weekday (Sen/Rab/Jum) dari hari ini sampai AKHIR BULAN
   * BERIKUTNYA (batas kalender). Weekend TIDAK di-generate di sini —
   * event-driven saat user pilih di_kos per minggu (setWeekendStatus).
   * Tidak ada auto-generate / cron jadwal.
   */
  async generateRestOfWeek(payload: CurrentUserPayload) {
    const anggota = await this.requirePj(payload);
    const today = this.toDate(new Date());
    // End of NEXT calendar month (UTC-midnight).
    const endOfNextMonth = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth() + 2,
        0, // day 0 bulan setelahnya = hari terakhir bulan berikutnya
      ),
    );

    let count = 0;
    for (
      let cursor = today;
      cursor <= endOfNextMonth;
      cursor = this.addDays(cursor, 1)
    ) {
      if (this.isPiketDay(cursor)) {
        if (await this.ensureWeekday(anggota.rumahId!, cursor)) count += 1;
      }
    }

    // Reset marker "jadwal habis sudah dinotif" — bulan baru digenerate.
    await this.cache.invalidate('schedule', `exhausted:${anggota.rumahId}`);
    await this.cache.invalidateScope(`dashboard:${anggota.rumahId}`);
    return { message: 'Jadwal bulanan telah dibuat.', count };
  }

  async generateWeekend(payload: CurrentUserPayload) {
    const anggota = await this.requirePj(payload);
    const monday = this.mondayOf(new Date());
    await this.ensureWeekendWeek(anggota.rumahId!, monday);
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
      // the weekend Jadwal so the UI shows who piket right away.
      await this.ensureWeekendWeek(anggota.rumahId, monday);
      // Locked decision (2026-08-12): di_kos → bebas weekday minggu itu.
      // Hapus weekday milik user, TIDAK digantikan siapa pun.
      await this.clearWeekdayForMember(anggota.rumahId, anggota.id, monday);
    } else {
      // Locked decision (2026-08-12): pulang menghapus jadwal weekend milik
      // anggota ini, lalu regenerate sisa anggota di_kos agar distribusi
      // weekend tetap valid. Weekday yang dihapus saat di_kos DIKEMBALIKAN
      // (locked 2026-08-12): isi ulang slot weekday kosong untuk member ini.
      await this.deleteMemberWeekendJadwal(anggota.rumahId, anggota.id, monday);
      await this.ensureWeekendWeek(anggota.rumahId, monday);
      await this.restoreWeekdayForMember(anggota.rumahId, anggota.id, monday);
    }

    this.logger.log(
      `[ScheduleService] ${anggota.nama} weekend → ${dto.status}`,
    );
    await this.cache.invalidateScope(`dashboard:${anggota.rumahId}`);
    // Notifikasi ke semua anggota lain (kecuali pengubah status).
    await this.notifications.notifyWeekendStatus(
      anggota.rumahId,
      anggota.nama,
      dto.status,
    );
    this.realtime.emitToRumah(anggota.rumahId, 'schedule:updated', {
      status: dto.status,
    });
    return { status: dto.status };
  }

  /**
   * Bebas weekday tanpa regenerate (locked 2026-08-12): saat user pilih
   * `di_kos`, pada minggu itu dia bebas piket weekday — hapus baris Jadwal
   * weekday miliknya di minggu itu (Sen/Rab/Jum SAJA, BUKAN weekend).
   * TIDAK digantikan siapa pun (hari jadi tanpa penanggung jawab).
   */
  private async clearWeekdayForMember(
    rumahId: string,
    anggotaId: string,
    monday: Date,
  ): Promise<void> {
    // Hapus hanya hari piket weekday (Sabtu/Minggu di-keep — weekend yang
    // baru dibuat oleh ensureWeekendWeek tidak boleh terhapus).
    const weekdayDates: Date[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const day = this.addDays(monday, offset);
      if (this.isPiketDay(day)) weekdayDates.push(day);
    }

    const result = await this.prisma.jadwal.deleteMany({
      where: {
        rumahId,
        anggotaId,
        tanggal: { in: weekdayDates },
      },
    });
    if (result.count > 0) {
      this.logger.log(
        `[ScheduleService] Hapus ${result.count} weekday ${anggotaId} (bebas piket)`,
      );
    }
  }

  /**
   * Pulang → weekday kembali (locked 2026-08-12): setelah jadwal weekend
   * dihapus, assign member ini ke hari piket MINGGU BERJALAN yang memang
   * miliknya berdasar round-robin `weekdayOrdinal(day) % n` (A → Rabu,
   * B → Jumat). Slot anggota lain TIDAK disentuh.
   */
  private async restoreWeekdayForMember(
    rumahId: string,
    anggotaId: string,
    monday: Date,
  ): Promise<void> {
    const sunday = this.addDays(monday, 6);
    const today = this.toDate(new Date());
    const allMembers = await this.members(rumahId);
    const n = allMembers.length;
    const myIndex = allMembers.findIndex((m) => m.id === anggotaId);
    if (myIndex === -1) return;

    const rooms = await this.activeRoomNames(rumahId);
    let created = 0;
    for (
      let cursor = today; // jangan restore hari lewat
      cursor <= sunday;
      cursor = this.addDays(cursor, 1)
    ) {
      if (!this.isPiketDay(cursor)) continue;
      // Hanya hari yang memang milik member ini berdasar round-robin.
      if (this.weekdayOrdinal(cursor) % n !== myIndex) continue;
      const exists = await this.prisma.jadwal.findFirst({
        where: { rumahId, tanggal: cursor },
        select: { id: true },
      });
      if (exists) continue; // slot sudah terisi (mungkin sudah dikembalikan)
      await this.prisma.jadwal.create({
        data: { rumahId, tanggal: cursor, anggotaId, ruangan: rooms },
      });
      created += 1;
    }
    if (created > 0) {
      this.logger.log(
        `[ScheduleService] Pulang: ${created} weekday ${anggotaId} dikembalikan`,
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

  /**
   * Daily 22:00 — cek jadwal weekday masa depan. Jika TIDAK ada lagi jadwal
   * weekday (hari ini ke depan), jadwal bulan habis → kirim notif ke PJ
   * (sekali, via Redis marker) agar generate jadwal baru. Empty state di
   * mobile otomatis muncul karena minggu kosong.
   */
  @Cron(CronExpression.EVERY_DAY_AT_10PM)
  async scheduleExhaustedReminder(): Promise<void> {
    const today = this.toDate(new Date());
    const rumahs = await this.prisma.rumah.findMany({ select: { id: true } });

    for (const rumah of rumahs) {
      const futureWeekday = await this.prisma.jadwal.findFirst({
        where: {
          rumahId: rumah.id,
          tanggal: { gte: today },
        },
        select: { id: true },
      });
      if (futureWeekday) continue; // masih ada jadwal

      // Habis — notif sekali (marker). Redis TTL ~45 hari cukup menutup gap
      // antar generate.
      const already = await this.cache.get<{ sent: boolean }>(
        'schedule',
        `exhausted:${rumah.id}`,
      );
      if (already) continue;
      await this.cache.set(
        'schedule',
        `exhausted:${rumah.id}`,
        { sent: true },
        45 * 24 * 60 * 60,
      );

      const pj = await this.prisma.anggota.findFirst({
        where: { rumahId: rumah.id, role: 'admin' },
        select: { id: true },
      });
      if (pj) await this.notifications.notifyPjGenerateReminder(pj.id);
    }
    this.logger.log('[ScheduleService] Cek jadwal habis (22:00) selesai');
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
    await this.ensureWeekendWeek(anggota.rumahId!, monday);
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
   * [REMOVED 2026-08-12] — jadwal digenerate manual bulanan oleh PJ. Tidak ada
   * cron jadwal lagi.
   */

  /**
   * Daily self-heal (2026-08-10): ensure the current week's weekday roster
   * exists for today → Sunday (never past days). Idempotent via ensureWeekday,
   * so a missed Saturday pregenerate (server down) is caught up the next
   * morning — Monday no longer requires a manual "Generate Jadwal".
   * [REMOVED 2026-08-12] — jadwal digenerate manual bulanan oleh PJ.
   */

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
