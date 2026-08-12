import { Injectable } from '@nestjs/common';
import { PrismaService } from '@serumah/db/prisma';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RumahScopeService } from '../../common/services/rumah-scope.service';
import { CacheService } from '../redis/cache.service';
import { GalonService } from '../galon/galon.service';

const PIKET_WEEKDAYS = [1, 3, 5]; // Senin(1), Rabu(3), Jumat(5)
const FREEZE_HOUR = 20; // Jumat 20:00 WIB
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta is UTC+7, no DST
const DOW_FULL = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

type StatusTag =
  'Hari ini' | 'Selesai' | 'Terjadwal' | 'Bolong' | 'Free' | 'LIBUR';

export interface ScheduleRow {
  tanggal: Date;
  dow: string;
  anggotaList: { id: string; nama: string }[];
  isMine: boolean;
  ruangan: string[];
  statusTag: StatusTag;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RumahScopeService,
    private readonly galonService: GalonService,
    private readonly cache: CacheService,
  ) {}

  async getDashboard(payload: CurrentUserPayload) {
    const anggota = await this.scope.requireAnggota(payload.userId);
    if (!anggota.rumahId) {
      return this.noRumahDashboard(anggota);
    }

    const scope = `dashboard:${anggota.rumahId}`;
    const resource = anggota.id;
    const cached = await this.cache.get(scope, resource);
    if (cached) {
      return cached;
    }

    const dashboard = await this.buildDashboard({
      id: anggota.id,
      rumahId: anggota.rumahId,
      nama: anggota.nama,
      role: anggota.role,
    });
    await this.cache.set(scope, resource, dashboard);
    return dashboard;
  }

  private noRumahDashboard(anggota: {
    id: string;
    nama: string;
    role: string;
  }) {
    return {
      weekend: {
        status: null,
        frozen: false,
        anggotaLain: [],
      },
      galon: { giliran: null, namaAnggota: null, isMine: false },
      billing: {
        total: 0,
        lunas: 0,
        totalUnpaid: 0,
        countUnpaid: 0,
        bulan: null,
      },
      scheduleWeek: [],
      scheduleIncomplete: false,
      isAdmin: anggota.role === 'admin',
      memberName: anggota.nama,
    };
  }

  private async buildDashboard(anggota: {
    id: string;
    rumahId: string;
    nama: string;
    role: string;
  }) {
    const [
      galon,
      weekend,
      anggotaLain,
      billing,
      scheduleWeek,
      scheduleIncomplete,
    ] = await Promise.all([
      this.galonService.currentFromAnggota(anggota),
      this.getWeekend(anggota.id),
      this.getAnggotaLain(anggota.rumahId, anggota.id),
      this.getBilling(anggota.id),
      this.getScheduleWeek(anggota.rumahId, anggota.id),
      this.isWeekIncomplete(anggota.rumahId),
    ]);

    return {
      weekend: { ...weekend, anggotaLain },
      galon,
      billing,
      scheduleWeek,
      scheduleIncomplete,
      isAdmin: anggota.role === 'admin',
      memberName: anggota.nama,
    };
  }

  // ── WEEKEND ─────────────────────────────────────────────────────────
  private async getWeekend(anggotaId: string) {
    const monday = this.mondayOf(new Date());
    const rows = await this.prisma.weekendStatus.findMany({
      where: { anggotaId, mingguMulai: monday },
    });

    // 1 pilihan utk seluruh weekend (Sabtu+Minggu di-set bersamaan, locked
    // 2026-08-11) — ambil status dari hari sabtu (identik dgn minggu).
    const status = rows.find((r) => r.hari === 'sabtu')?.status ?? null;

    return {
      status,
      frozen: this.isFrozen(monday),
    };
  }

  /**
   * Status weekend semua anggota lain di rumah (untuk card weekend Beranda).
   * Label per anggota: "Di kos weekend" bila ada satu hari di kos, "Pulang"
   * bila dua-duanya pulang, "Belum pilih" bila belum ada status.
   */
  private async getAnggotaLain(
    rumahId: string,
    excludeAnggotaId: string,
  ): Promise<{ id: string; nama: string; status: string }[]> {
    const monday = this.mondayOf(new Date());
    const [members, rows] = await Promise.all([
      this.prisma.anggota.findMany({
        where: { rumahId },
        orderBy: { nama: 'asc' },
        select: { id: true, nama: true },
      }),
      this.prisma.weekendStatus.findMany({
        where: { mingguMulai: monday, anggota: { rumahId } },
      }),
    ]);

    return members
      .filter((m) => m.id !== excludeAnggotaId)
      .map((m) => {
        const mine = rows.filter((r) => r.anggotaId === m.id);
        const sabtu = mine.find((r) => r.hari === 'sabtu')?.status;
        const minggu = mine.find((r) => r.hari === 'minggu')?.status;
        let status = 'Belum pilih';
        if (sabtu === 'di_kos' || minggu === 'di_kos')
          status = 'Di kos weekend';
        else if (sabtu === 'pulang' && minggu === 'pulang') status = 'Pulang';
        return { id: m.id, nama: m.nama, status };
      });
  }

  private isFrozen(monday: Date): boolean {
    // Freeze = Friday 20:00 WIB. monday is UTC-midnight; add 4 days then shift
    // wall-clock 20:00 WIB to an absolute instant (UTC+7, no DST).
    const fridayUtc = this.addDays(monday, 4);
    const freezeAt = new Date(
      fridayUtc.getTime() + FREEZE_HOUR * 60 * 60 * 1000 - WIB_OFFSET_MS,
    );
    return new Date() > freezeAt;
  }

  // ── BILLING (user only) ─────────────────────────────────────────────
  private async getBilling(anggotaId: string) {
    const now = new Date();
    const firstOfMonth = this.toDay(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    );

    const [iuran, denda] = await Promise.all([
      this.prisma.iuranBulanan.findMany({
        where: { anggotaId, bulan: firstOfMonth },
      }),
      this.prisma.denda.findMany({
        where: {
          anggotaId,
          status: { in: ['belum_bayar', 'menunggu_konfirmasi'] },
        },
      }),
    ]);

    const unpaidIuran = iuran.filter((i) => i.status !== 'lunas');
    const unpaidDenda = denda.filter((d) => d.status !== 'lunas');

    const total = iuran.reduce((s, i) => s + i.nominal, 0);
    const lunas = iuran
      .filter((i) => i.status === 'lunas')
      .reduce((s, i) => s + i.nominal, 0);

    return {
      total,
      lunas,
      totalUnpaid:
        unpaidIuran.reduce((s, i) => s + i.nominal, 0) +
        unpaidDenda.reduce((s, d) => s + d.nominal, 0),
      countUnpaid: unpaidIuran.length + unpaidDenda.length,
      bulan: firstOfMonth,
    };
  }

  // ── SCHEDULE INCOMPLETE (PJ banner) ─────────────────────────────────
  /**
   * True when the current week still has an upcoming piket day (from today
   * through Sunday) that is not yet scheduled — either a weekday piket day
   * with no Jadwal, or a weekend day with Di kos members but no Jadwal yet.
   * Used by the PJ reminder banner on Beranda.
   */
  private async isWeekIncomplete(rumahId: string): Promise<boolean> {
    const today = this.toDay(new Date());
    const monday = this.mondayOf(today);
    const sunday = this.addDays(monday, 6);

    const [jadwal, weekendRows] = await Promise.all([
      this.prisma.jadwal.findMany({
        where: { rumahId, tanggal: { gte: today, lte: sunday } },
        select: { tanggal: true },
      }),
      this.prisma.weekendStatus.findMany({
        where: { mingguMulai: monday },
        select: { hari: true, status: true },
      }),
    ]);

    const scheduledDays = new Set(jadwal.map((j) => this.key(j.tanggal)));
    const diKosHari = new Set(
      weekendRows.filter((r) => r.status === 'di_kos').map((r) => r.hari),
    );

    for (
      let cursor = today;
      cursor <= sunday;
      cursor = this.addDays(cursor, 1)
    ) {
      const dow = cursor.getUTCDay();
      if (PIKET_WEEKDAYS.includes(dow)) {
        if (!scheduledDays.has(this.key(cursor))) return true;
      } else if (dow === 6 || dow === 0) {
        const hari = dow === 6 ? 'sabtu' : 'minggu';
        if (diKosHari.has(hari) && !scheduledDays.has(this.key(cursor))) {
          return true;
        }
      }
    }
    return false;
  }

  // ── SCHEDULE WEEK ───────────────────────────────────────────────────
  private async getScheduleWeek(
    rumahId: string,
    currentAnggotaId?: string,
  ): Promise<ScheduleRow[]> {
    const monday = this.mondayOf(new Date());
    const sunday = this.addDays(monday, 6);
    const today = this.toDay(new Date());

    const jadwal = await this.prisma.jadwal.findMany({
      where: { rumahId, tanggal: { gte: monday, lte: sunday } },
      orderBy: { tanggal: 'asc' },
      select: {
        tanggal: true,
        anggota: { select: { id: true, nama: true } },
        ruangan: true,
        submissions: { select: { status: true } },
      },
    });

    // Pekan belum punya jadwal sama sekali → kosong; Beranda menampilkan
    // empty state (anggota) / banner pengingat (admin) alih-alih baris palsu.
    if (jadwal.length === 0) {
      return [];
    }

    const rows: ScheduleRow[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const day = this.addDays(monday, offset);
      const dowIndex = day.getUTCDay();
      const dayJadwal = jadwal.filter((j) => this.key(j.tanggal) === this.key(day));
      const record = dayJadwal[0]; // untuk status tag / submission
      const isWeekend = dowIndex === 0 || dowIndex === 6;

      let statusTag: StatusTag;
      if (isWeekend) {
        // Weekend aktif HANYA jika ada jadwal (seseorang dapat piket hari itu).
        if (record) {
          statusTag = this.submissionTag(record, day, today, true);
        } else {
          statusTag = 'Free'; // tidak ada yang dapat piket hari itu
        }
      } else if (!PIKET_WEEKDAYS.includes(dowIndex)) {
        statusTag = 'LIBUR';
      } else {
        statusTag = this.submissionTag(record, day, today, false);
      }

      rows.push({
        tanggal: day,
        dow: DOW_FULL[dowIndex],
        anggotaList: dayJadwal.map((j) => j.anggota),
        isMine: dayJadwal.some((j) => j.anggota.id === currentAnggotaId),
        ruangan: dayJadwal[0]?.ruangan ?? [],
        statusTag,
      });
    }

    return rows;
  }

  private submissionTag(
    record:
      | {
          anggota: { id: string; nama: string };
          ruangan: string[];
          submissions: { status: string }[];
        }
      | undefined,
    day: Date,
    today: Date,
    weekendDiKos = false,
  ): StatusTag {
    if (record == null) {
      // Weekend Di kos tanpa jadwal (belum generate) = "Terjadwal" (chip
      // rounded). Weekend Di kos DENGAN jadwal tapi belum ada jadwal sama
      // sekali tetap menunggu. Weekday tanpa jadwal = LIBUR.
      return weekendDiKos ? 'Terjadwal' : 'LIBUR';
    }
    const status = record.submissions[0]?.status;
    if (status === 'approved') return 'Selesai';
    if (status === 'bolong' || status === 'rejected') return 'Bolong';
    return this.isSameDay(day, today) ? 'Hari ini' : 'Terjadwal';
  }

  // ── HELPERS (UTC-based, matches @db.Date storage) ─────────────────────
  private mondayOf(date: Date): Date {
    const d = this.toDay(date);
    const offset = d.getUTCDay() === 0 ? -6 : 1 - d.getUTCDay();
    return this.addDays(d, offset);
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

  private toDay(date: Date): Date {
    // Resolve the WIB calendar day of the input, then canonicalize it as
    // UTC-midnight so @db.Date storage, comparisons, and getUTCDay() agree.
    const wib = new Date(date.getTime() + WIB_OFFSET_MS);
    return new Date(
      Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()),
    );
  }

  private isSameDay(a: Date, b: Date): boolean {
    return this.key(a) === this.key(b);
  }

  private key(date: Date): string {
    const d = this.toDay(date);
    return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
  }
}
