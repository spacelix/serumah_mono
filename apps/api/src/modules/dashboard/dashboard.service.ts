import { Injectable } from '@nestjs/common';
import { PrismaService } from '@serumah/db/prisma';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RumahScopeService } from '../../common/services/rumah-scope.service';
import { CacheService } from '../redis/cache.service';
import { GalonService } from '../galon/galon.service';

const PIKET_WEEKDAYS = [1, 3, 5]; // Senin(1), Rabu(3), Jumat(5)
const FREEZE_HOUR = 20;
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
  anggota: { id: string; nama: string } | null;
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
        saturday: null,
        sunday: null,
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

    const fetch = (hari: 'sabtu' | 'minggu') =>
      rows.find((r) => r.hari === hari)?.status ?? null;

    return {
      saturday: fetch('sabtu'),
      sunday: fetch('minggu'),
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
      this.prisma.weekendStatus.findMany({ where: { mingguMulai: monday } }),
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
    const freezeAt = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + 4, // Jumat
      FREEZE_HOUR,
      0,
      0,
    );
    return new Date() > freezeAt;
  }

  // ── BILLING (user only) ─────────────────────────────────────────────
  private async getBilling(anggotaId: string) {
    const firstOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
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
      const dow = cursor.getDay();
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

    const [jadwal, weekendRows] = await Promise.all([
      this.prisma.jadwal.findMany({
        where: { rumahId, tanggal: { gte: monday, lte: sunday } },
        orderBy: { tanggal: 'asc' },
        select: {
          tanggal: true,
          anggota: { select: { id: true, nama: true } },
          ruangan: true,
          submissions: { select: { status: true } },
        },
      }),
      this.prisma.weekendStatus.findMany({ where: { mingguMulai: monday } }),
    ]);

    // Pekan belum punya jadwal sama sekali → kosong; Beranda menampilkan
    // empty state (anggota) / banner pengingat (admin) alih-alih baris palsu.
    if (jadwal.length === 0) {
      return [];
    }

    const jadwalByDate = new Map(jadwal.map((j) => [this.key(j.tanggal), j]));
    const diKosByHari = new Map<'sabtu' | 'minggu', boolean>();
    for (const r of weekendRows) {
      if (r.status === 'di_kos')
        diKosByHari.set(r.hari as 'sabtu' | 'minggu', true);
    }

    const rows: ScheduleRow[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const day = this.addDays(monday, offset);
      const dowIndex = day.getDay();
      const record = jadwalByDate.get(this.key(day));
      const isWeekend = dowIndex === 0 || dowIndex === 6;

      let statusTag: StatusTag;
      if (isWeekend) {
        const hari = dowIndex === 6 ? 'sabtu' : 'minggu';
        if (diKosByHari.get(hari)) {
          statusTag = this.submissionTag(record, day, today);
        } else {
          statusTag = 'Free'; // everyone Pulang — free day
        }
      } else if (!PIKET_WEEKDAYS.includes(dowIndex)) {
        statusTag = 'LIBUR';
      } else {
        statusTag = this.submissionTag(record, day, today);
      }

      rows.push({
        tanggal: day,
        dow: DOW_FULL[dowIndex],
        anggota: record?.anggota ?? null,
        isMine: record?.anggota.id === currentAnggotaId,
        ruangan: record?.ruangan ?? [],
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
  ): StatusTag {
    if (record == null) {
      return 'LIBUR';
    }
    const status = record.submissions[0]?.status;
    if (status === 'approved') return 'Selesai';
    if (status === 'bolong' || status === 'rejected') return 'Bolong';
    return this.isSameDay(day, today) ? 'Hari ini' : 'Terjadwal';
  }

  // ── HELPERS ─────────────────────────────────────────────────────────
  private mondayOf(date: Date): Date {
    const d = this.toDay(date);
    const offset = d.getDay() === 0 ? -6 : 1 - d.getDay();
    return this.addDays(d, offset);
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  private toDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private isSameDay(a: Date, b: Date): boolean {
    return this.key(a) === this.key(b);
  }

  private key(date: Date): string {
    const d = this.toDay(date);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
}
