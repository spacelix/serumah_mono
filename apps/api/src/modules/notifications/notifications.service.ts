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
    if (anggotaIds.length === 0 || !this.fcm.enabled) return;
    const members = await this.prisma.anggota.findMany({
      where: { id: { in: anggotaIds } },
      select: { id: true, pushToken: true },
    });
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
}
