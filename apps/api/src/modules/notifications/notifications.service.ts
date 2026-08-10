import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@serumah/db/prisma';
import { FcmService, type PushMessage } from '../fcm/fcm.service';

/**
 * Scenario senders for push notifications. Each method resolves recipients
 * (by pushToken) and dispatches via FcmService; invalid tokens are cleared.
 * All callers guard idempotency before calling (e.g. only while a record is
 * still pending) — this service never decides "should we send", it only sends.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmService,
  ) {}

  /** Send to a list of anggota ids; clear tokens that FCM rejects. */
  async sendToAnggota(anggotaIds: string[], msg: PushMessage): Promise<void> {
    if (anggotaIds.length === 0) {
      this.logger.warn('[NotificationsService] Kirim dilewati: tidak ada penerima');
      return;
    }
    if (!this.fcm.enabled) {
      this.logger.warn(
        '[NotificationsService] FCM tidak aktif (FCM_PROJECT_ID/FCM_CLIENT_EMAIL/FCM_PRIVATE_KEY belum ter-set) — notif dilewati',
      );
      return;
    }
    const members = await this.prisma.anggota.findMany({
      where: { id: { in: anggotaIds } },
      select: { id: true, pushToken: true },
    });
    this.logger.log(
      `[NotificationsService] Kirim "${msg.title}" → ${members.length} anggota`,
    );
    const invalid: string[] = [];
    for (const m of members) {
      if (!m.pushToken) continue;
      const ok = await this.fcm.sendToToken(m.pushToken, msg);
      if (!ok) invalid.push(m.id);
    }
    if (invalid.length > 0) {
      await this.prisma.anggota.updateMany({
        where: { id: { in: invalid } },
        data: { pushToken: null, pushTokenUpdatedAt: null },
      });
      this.logger.log(`[NotificationsService] Hapus ${invalid.length} token basi`);
    }
  }

  async notifyPiketReviewer(
    reviewerId: string,
    submitterName: string,
  ): Promise<void> {
    await this.sendToAnggota([reviewerId], {
      title: 'Piket nunggu verifikasi',
      body: `${submitterName} ngirim piket buat diverifikasi.`,
      deepLink: '/(tabs)/piket',
    });
  }

  async notifySwapIncoming(keId: string, fromName: string): Promise<void> {
    await this.sendToAnggota([keId], {
      title: 'Permintaan swap masuk',
      body: `${fromName} mau tukar jadwal piket sama lo.`,
      deepLink: '/(tabs)/swap',
    });
  }

  async notifySwapAccepted(dariId: string, nama: string): Promise<void> {
    await this.sendToAnggota([dariId], {
      title: 'Swap disetujui',
      body: `${nama} nerima swap lo — jadwal udah ketuker.`,
      deepLink: '/(tabs)/swap',
    });
  }

  async notifySwapRejected(dariId: string, nama: string): Promise<void> {
    await this.sendToAnggota([dariId], {
      title: 'Swap ditolak',
      body: `${nama} nolak swap lo — jadwal balik ke lo.`,
      deepLink: '/(tabs)/swap',
    });
  }

  async notifyPaymentReviewer(reviewerId: string, what: 'denda' | 'iuran'): Promise<void> {
    await this.sendToAnggota([reviewerId], {
      title: 'Bukti bayar nunggu konfirmasi',
      body:
        what === 'denda'
          ? 'Ada bukti bayar denda nunggu dikonfirmasi.'
          : 'Ada bukti bayar iuran nunggu dikonfirmasi.',
      deepLink: '/(tabs)/tagihan',
    });
  }

  async notifyGalonBought(
    rumahId: string,
    buyerName: string,
    nextName: string | null,
  ): Promise<void> {
    const members = await this.prisma.anggota.findMany({
      where: { rumahId },
      select: { id: true, nama: true },
    });
    const others = members
      .filter((m) => m.nama !== buyerName)
      .map((m) => m.id);
    await this.sendToAnggota(others, {
      title: 'Galon udah dibeli',
      body: nextName
        ? `${buyerName} udah beli galon — giliran berikutnya ${nextName}.`
        : `${buyerName} udah beli galon.`,
      deepLink: '/',
    });
  }

  async notifyGalonNudge(nextId: string): Promise<void> {
    await this.sendToAnggota([nextId], {
      title: 'Giliran galon lo',
      body: 'Galon udah saatnya dibeli — giliran lo sekarang.',
      deepLink: '/',
    });
  }

  async notifyDendaReminder(anggotaId: string, count: number, total: number): Promise<void> {
    await this.sendToAnggota([anggotaId], {
      title: 'Denda belum dibayar',
      body: `Lo punya ${count} denda belum dibayar, total Rp ${total.toLocaleString('id-ID')}.`,
      deepLink: '/(tabs)/tagihan',
    });
  }

  async notifyIuranNextMonth(anggotaId: string, monthLabel: string, total: number): Promise<void> {
    await this.sendToAnggota([anggotaId], {
      title: `Iuran ${monthLabel} udah keluar`,
      body: `Tagihan iuran lo bulan depan: Rp ${total.toLocaleString('id-ID')}.`,
      deepLink: '/(tabs)/tagihan',
    });
  }

  async notifyPiketReminder(
    anggotaId: string,
    message: string,
  ): Promise<void> {
    await this.sendToAnggota([anggotaId], {
      title: 'Piket hari ini',
      body: message,
      deepLink: '/(tabs)/piket',
    });
  }

  /**
   * Weekend status berubah (Di kos/Pulang) → info ke semua anggota lain.
   * `nama` = yang mengubah status; `hari` = 'sabtu'/'minggu'; `status` =
   * 'di_kos'/'pulang'. Tanpa detail siapa yang dapat jadwal piket.
   */
  async notifyWeekendStatus(
    rumahId: string,
    nama: string,
    hari: 'sabtu' | 'minggu',
    status: 'di_kos' | 'pulang',
  ): Promise<void> {
    const hariLabel = hari === 'sabtu' ? 'Sabtu' : 'Minggu';
    const statusLabel = status === 'di_kos' ? 'pilih Di kos' : 'pulang';
    const members = await this.prisma.anggota.findMany({
      where: { rumahId },
      select: { id: true, nama: true },
    });
    const others = members.filter((m) => m.nama !== nama).map((m) => m.id);
    await this.sendToAnggota(others, {
      title: 'Status akhir pekan',
      body: `${nama} ${statusLabel} untuk ${hariLabel}.`,
      deepLink: '/',
    });
  }

  /**
   * Reminder belum memilih status weekend (Di kos/Pulang). Ke satu anggota
   * yang belum punya WeekendStatus untuk minggu ini + hari tersebut.
   */
  async notifyWeekendReminder(
    anggotaId: string,
    hari: 'sabtu' | 'minggu',
  ): Promise<void> {
    const hariLabel = hari === 'sabtu' ? 'Sabtu' : 'Minggu';
    await this.sendToAnggota([anggotaId], {
      title: 'Pilih status akhir pekan',
      body: `Belum pilih Di kos / Pulang buat ${hariLabel}. Deadline Jumat 20:00.`,
      deepLink: '/',
    });
  }

  /**
   * Freeze tercapai dan anggota belum konfirmasi status weekend sama sekali —
   * dianggap bertanggung jawab sepenuhnya akhir pekan ini.
   */
  async notifyWeekendMissed(anggotaId: string): Promise<void> {
    await this.sendToAnggota([anggotaId], {
      title: 'Status akhir pekan lo belum dipilih',
      body: 'Lo ga konfirmasi Pulang atau Di kos, jadi buat weekend ini lo bertanggung jawab sepenuhnya.',
      deepLink: '/',
    });
  }

  /**
   * Ada versi baru Serumah tersedia — broadcast ke semua anggota yang punya
   * push token (dipicu GitHub Actions setelah release).
   */
  async notifyUpdateAvailable(
    versionName: string,
    notes?: string,
  ): Promise<void> {
    const members = await this.prisma.anggota.findMany({
      where: { pushToken: { not: null } },
      select: { id: true },
    });
    await this.sendToAnggota(
      members.map((m) => m.id),
      {
        title: `Update Serumah ${versionName} tersedia`,
        body: notes || 'Versi baru udah rilis — ketuk buat update.',
        deepLink: '/',
      },
    );
  }
}
