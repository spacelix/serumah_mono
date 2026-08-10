import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { webcrypto } from 'node:crypto';

// FCM HTTP v1 (no SDK): POST /v1/projects/{project}/messages:send with a
// signed JWT bearer. Tokens with the "ExponentPushToken[...]" prefix come from
// expo-notifications and are relayed through Expo's push service instead.
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

export interface PushMessage {
  title: string;
  body: string;
  deepLink?: string;
}

/**
 * Minimal FCM sender. `sendToAnggota` resolves each anggota's pushToken and
 * calls `send`. Stale/invalid tokens (UNREGISTERED / INVALID_ARGUMENT) are
 * cleared via the provided `onInvalid` callback.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);

  private projectId: string | null;
  private clientEmail: string | null;
  private privateKey: string | null;

  constructor(private readonly config: ConfigService) {
    this.projectId = this.config.get<string>('FCM_PROJECT_ID') ?? null;
    this.clientEmail = this.config.get<string>('FCM_CLIENT_EMAIL') ?? null;
    this.privateKey = this.config.get<string>('FCM_PRIVATE_KEY') ?? null;
  }

  /** True when FCM is configured and can actually send. */
  get enabled(): boolean {
    return Boolean(this.projectId && this.clientEmail && this.privateKey);
  }

  /** Human-readable config status (for debugging). */
  get configSummary(): string {
    return `enabled=${this.enabled} projectId=${this.projectId ?? '(kosong)'} clientEmail=${this.clientEmail ? '(terisi)' : '(kosong)'} privateKey=${this.privateKey ? '(terisi)' : '(kosong)'}`;
  }

  /**
   * Send a push to a single token. Returns false when the token is invalid
   * (so the caller can clear it). No-op + true when FCM is not configured.
   */
  async sendToToken(token: string, msg: PushMessage): Promise<boolean> {
    if (!this.enabled) {
      this.logger.warn(
        `[FcmService] FCM tidak aktif (${this.configSummary}) — notif dilewati.`,
      );
      return true;
    }
    if (token.startsWith('ExponentPushToken[')) {
      return this.sendViaExpo(token, msg);
    }
    return this.sendViaFcm(token, msg);
  }

  private async sendViaFcm(token: string, msg: PushMessage): Promise<boolean> {
    try {
      const jwt = await this.signedJwt();
      const body = {
        message: {
          token,
          notification: { title: msg.title, body: msg.body },
          data: msg.deepLink ? { deepLink: msg.deepLink } : {},
          android: { priority: 'high' as const },
        },
      };
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) return true;
      const err = (await res.json()) as { error?: { status?: string } };
      const status = err?.error?.status ?? `HTTP ${res.status}`;
      if (status === 'UNREGISTERED' || status === 'INVALID_ARGUMENT') {
        this.logger.warn(`[FcmService] Token tidak valid (${status}), hapus.`);
        return false;
      }
      this.logger.warn(`[FcmService] FCM error ${status}: ${msg.title}`);
      return true;
    } catch (e) {
      this.logger.error(`[FcmService] Gagal kirim FCM: ${e instanceof Error ? e.message : e}`);
      return true;
    }
  }

  private async sendViaExpo(token: string, msg: PushMessage): Promise<boolean> {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: token,
          title: msg.title,
          body: msg.body,
          data: msg.deepLink ? { deepLink: msg.deepLink } : {},
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { data?: { status?: string }[] };
        const status = err?.data?.[0]?.status;
        if (status === 'DeviceNotRegistered') {
          this.logger.warn('[FcmService] Expo token tidak valid, hapus.');
          return false;
        }
      }
      return true;
    } catch (e) {
      this.logger.error(
        `[FcmService] Gagal kirim via Expo: ${e instanceof Error ? e.message : e}`,
      );
      return true;
    }
  }

  private async signedJwt(): Promise<string> {
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      iss: this.clientEmail,
      scope: FCM_SCOPE,
      aud: 'https://fcm.googleapis.com/',
      iat: now,
      exp: now + 3600,
    };
    const enc = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url');
    const unsigned = `${enc(header)}.${enc(claims)}`;

    const subtle = webcrypto.subtle;
    const key = await importCryptoKey(this.privateKey!, subtle);
    const signature = await subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(unsigned),
    );
    return `${unsigned}.${Buffer.from(signature).toString('base64url')}`;
  }
}

async function importCryptoKey(
  pem: string,
  subtle: typeof webcrypto.subtle,
): Promise<Awaited<ReturnType<typeof webcrypto.subtle.importKey>>> {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const der = Uint8Array.from(Buffer.from(base64, 'base64'));
  return subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}
