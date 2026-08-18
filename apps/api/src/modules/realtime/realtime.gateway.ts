import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '@serumah/db/prisma';

/**
 * Realtime push untuk update yang harus langsung tampil (swap masuk,
 * approve/reject, verifikasi, galon, weekend) tanpa pull-to-refresh.
 *
 * Flow: client connect dengan token JWT di `auth.token` → server resolve
 * anggota + rumah → join room `rumah:{rumahId}`. Service memanggil
 * `realtime.emitToRumah(rumahId, event, payload)`; semua client di room itu
 * menerimanya, lalu React Query meng-invalidate query terkait.
 */
@WebSocketGateway({ cors: { origin: '*' }, path: '/socket.io' })
@Injectable()
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        this.logger.warn('[Realtime] Connect tanpa token, ditolak');
        client.disconnect(true);
        return;
      }
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const userId = payload.sub;
      const anggota = await this.prisma.anggota.findUnique({
        where: { id: userId },
        select: { id: true, rumahId: true },
      });
      if (!anggota?.rumahId) {
        client.disconnect(true);
        return;
      }
      (client.data as Record<string, unknown>).rumahId = anggota.rumahId;
      await client.join(this.rumahRoom(anggota.rumahId));
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    // Room membership auto-cleans saat disconnect — tidak perlu aksi.
    void client;
  }

  private rumahRoom(rumahId: string): string {
    return `rumah:${rumahId}`;
  }

  /** Kirim event ke semua client di rumah tertentu. */
  emitToRumah(rumahId: string, event: string, payload: unknown): void {
    this.server.to(this.rumahRoom(rumahId)).emit(event, payload);
  }
}
