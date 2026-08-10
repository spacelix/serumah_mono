import { Controller, Delete, Post, Body } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '@serumah/db/prisma';
import { PushTokenDto } from './dto/push-token.dto';

/**
 * Device push token registration. The app calls POST on login/start and
 * DELETE on logout so the backend never targets a stale device.
 */
@Controller('push')
export class PushTokenController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('token')
  async setToken(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: PushTokenDto,
  ) {
    await this.prisma.anggota.update({
      where: { id: payload.userId },
      data: { pushToken: dto.token, pushTokenUpdatedAt: new Date() },
    });
    return { ok: true };
  }

  @Delete('token')
  async clearToken(@CurrentUser() payload: CurrentUserPayload) {
    await this.prisma.anggota.update({
      where: { id: payload.userId },
      data: { pushToken: null, pushTokenUpdatedAt: null },
    });
    return { ok: true };
  }
}
