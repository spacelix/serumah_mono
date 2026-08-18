import { Injectable, Logger } from '@nestjs/common';

export interface PushMessage {
  title: string;
  body: string;
  deepLink?: string;
  /** Aksi opsional — client menggunakannya untuk memicu perilaku tertentu
   * saat notif di-tap (misal `update` → langsung re-check update). */
  action?: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Push via the Expo Push Service (best practice per docs.expo.dev): send the
 * `ExponentPushToken[...]` to exp.host and Expo relays it to FCM/APNs. No FCM
 * service-account credentials needed on the server — the app registers its
 * token with `getExpoPushTokenAsync` and the backend just posts to Expo.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);

  /** Expo Push Service is always available — no env required. */
  get enabled(): boolean {
    return true;
  }

  get configSummary(): string {
    return 'expo-push-service';
  }

  /**
   * Send a push to a single token via Expo. Returns false when the token is
   * no longer registered (so the caller can clear it). Always true otherwise.
   */
  async sendToToken(token: string, msg: PushMessage): Promise<boolean> {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: token,
          title: msg.title,
          body: msg.body,
          data: {
            ...(msg.deepLink ? { deepLink: msg.deepLink } : {}),
            ...(msg.action ? { action: msg.action } : {}),
          },
        }),
      });
      const body = (await res.json()) as {
        data?: { status?: string; details?: { error?: string } }[];
      };
      const ticket = body?.data?.[0];
      if (
        ticket?.status === 'error' ||
        ticket?.details?.error === 'DeviceNotRegistered'
      ) {
        this.logger.warn(
          `[FcmService] Token tidak valid (${ticket?.details?.error ?? ticket?.status}), hapus.`,
        );
        return false;
      }
      return true;
    } catch (e) {
      this.logger.error(
        `[FcmService] Gagal kirim via Expo: ${e instanceof Error ? e.message : e}`,
      );
      return true;
    }
  }
}
