import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@serumah/db/prisma';
import { IuranService } from '../iuran/iuran.service';
import { NotificationsService } from './notifications.service';

// Asia/Jakarta = UTC+7, no DST. "Today"/"month" resolve via the WIB wall clock
// (same rule as schedule/iuran services).
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Piket reminder schedule. Each entry: cron, message. */
const PIKET_REMINDERS = [
  { cron: '0 7 * * *', message: 'Piket lo hari ini — deadline 20:00.' },
  { cron: '0 12 * * *', message: 'Jangan lupa piket lo sebelum jam 8 malam.' },
  { cron: '0 17 * * *', message: 'Piket belum dikerjain? Sisa 3 jam.' },
  { cron: '50 19 * * *', message: '10 menit lagi deadline piket!' },
] as const;

@Injectable()
export class NotificationsCronService {
  private readonly logger = new Logger(NotificationsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly iuran: IuranService,
  ) {}

  private todayWib(): Date {
    const now = new Date();
    const wib = new Date(now.getTime() + WIB_OFFSET_MS);
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

  private async todayPiket(): Promise<
    { rumahId: string; anggotaId: string }[]
  > {
    const today = this.todayWib();
    const rows = await this.prisma.jadwal.findMany({
      where: { tanggal: today },
      include: { submissions: { select: { id: true } } },
    });
    return rows
      .filter((r) => r.submissions.length === 0)
      .map((r) => ({ rumahId: r.rumahId, anggotaId: r.anggotaId }));
  }

  // ── A. Piket reminders ──────────────────────────────────────────────
  @Cron('0 7 * * *')
  @Cron('0 12 * * *')
  @Cron('0 17 * * *')
  @Cron('50 19 * * *')
  async piketReminder(): Promise<void> {
    const hour = this.todayWib().getUTCHours();
    const reminder =
      PIKET_REMINDERS.find((r) => this.cronHour(r.cron) === hour) ??
      PIKET_REMINDERS[PIKET_REMINDERS.length - 1];
    const piket = await this.todayPiket();
    for (const p of piket) {
      await this.notifications.notifyPiketReminder(p.anggotaId, reminder.message);
    }
    this.logger.log(
      `[NotificationsCron] Reminder piket ${hour}:00 → ${piket.length} orang`,
    );
  }

  private cronHour(cron: string): number {
    const m = /^(\d+) /.exec(cron);
    return m ? Number(m[1]) : -1;
  }

  // ── E. Weekend status — reminder belum pilih (Jumat) ─────────────────
  // Freeze = Jumat 20:00 WIB. Reminder Jumat 08:00 (nugas awal) + 19:00
  // (1 jam sebelum deadline) ke anggota yang belum punya WeekendStatus untuk
  // hari Sabtu/Minggu minggu berjalan.
  @Cron('0 8 * * 5')
  @Cron('0 19 * * 5')
  async weekendStatusReminder(): Promise<void> {
    const today = this.todayWib();
    const monday = this.mondayOfWib(today);
    const weekStart = monday;
    const weekEnd = this.addDays(monday, 6);

    const [anggotaRows, existingRows] = await Promise.all([
      this.prisma.anggota.findMany({
        where: { rumahId: { not: null } },
        select: { id: true, rumahId: true },
      }),
      this.prisma.weekendStatus.findMany({
        where: { mingguMulai: weekStart, hari: { in: ['sabtu', 'minggu'] } },
        select: { anggotaId: true, hari: true },
      }),
    ]);

    const chosen = new Map<string, Set<'sabtu' | 'minggu'>>();
    for (const r of existingRows) {
      const set = chosen.get(r.anggotaId) ?? new Set();
      set.add(r.hari as 'sabtu' | 'minggu');
      chosen.set(r.anggotaId, set);
    }

    const HARI_KE_BULAN = { sabtu: 5, minggu: 6 } as const;
    for (const a of anggotaRows) {
      if (!a.rumahId) continue;
      for (const hari of ['sabtu', 'minggu'] as const) {
        const sudahDipilih = chosen.get(a.id)?.has(hari) ?? false;
        if (sudahDipilih) continue;
        // Lewati hari yang sudah lewat (mis. reminder Sabtu saat sudah Minggu).
        const day = this.addDays(weekStart, HARI_KE_BULAN[hari]);
        if (day < today) continue;
        await this.notifications.notifyWeekendReminder(a.id, hari);
      }
    }
    this.logger.log(`[NotificationsCron] Reminder weekend status (Jumat)`);
  }

  /** Senin dari minggu yang memuat `date` (UTC-midnight). */
  private mondayOfWib(date: Date): Date {
    const day = date.getUTCDay();
    const offset = day === 0 ? -6 : 1 - day;
    return this.addDays(date, offset);
  }

  // ── C. Denda reminder mingguan ──────────────────────────────────────
  @Cron('0 8 * * 1')
  async dendaWeekly(): Promise<void> {
    const unpaid = await this.prisma.denda.groupBy({
      by: ['anggotaId'],
      where: { status: 'belum_bayar' },
      _count: { _all: true },
      _sum: { nominal: true },
    });
    for (const row of unpaid) {
      await this.notifications.notifyDendaReminder(
        row.anggotaId,
        row._count._all,
        row._sum.nominal ?? 0,
      );
    }
    this.logger.log(`[NotificationsCron] Denda mingguan → ${unpaid.length} anggota`);
  }

  // ── D. Iuran bulan depan — last day of month ────────────────────────
  @Cron('0 8 28-31 * *')
  async iuranNextMonth(): Promise<void> {
    const today = this.todayWib();
    // Next month's first day (UTC-midnight). `ensureBulan` treats the month as
    // a calendar month; pass next month's 1st.
    const next = this.addDays(
      new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
      0,
    );
    const nextMonth = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1),
    );

    // Only fire on the actual last day of the current month.
    const tomorrow = this.addDays(today, 1);
    if (tomorrow.getUTCMonth() === today.getUTCMonth()) return;

    const rumahs = await this.prisma.rumah.findMany({ select: { id: true } });
    for (const rumah of rumahs) {
      await this.iuran.ensureBulanForRumah(rumah.id, nextMonth);
      const members = await this.prisma.anggota.findMany({
        where: { rumahId: rumah.id },
        select: { id: true },
      });
      for (const m of members) {
        const sum = await this.prisma.iuranBulanan.aggregate({
          where: { anggotaId: m.id, bulan: nextMonth },
          _sum: { nominal: true },
        });
        const label = `${nextMonth.getUTCMonth() + 1}/${nextMonth.getUTCFullYear()}`;
        await this.notifications.notifyIuranNextMonth(
          m.id,
          label,
          sum._sum.nominal ?? 0,
        );
      }
    }
    this.logger.log(`[NotificationsCron] Iuran bulan depan (${next.toISOString()}) dikirim`);
  }
}
