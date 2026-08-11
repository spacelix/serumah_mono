import { Global, Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

/**
 * WebSocket realtime (Socket.io). Global supaya service mana pun bisa inject
 * `RealtimeGateway` dan memanggil `emitToRumah`. JWT di-verify di gateway
 * (JwtModule sudah global), Prisma dari `@serumah/db/prisma`.
 */
@Global()
@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
