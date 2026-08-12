import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateService } from './update.service';

@Controller('update')
export class UpdateController {
  constructor(
    private readonly updateService: UpdateService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('manifest')
  manifest() {
    return this.updateService.manifest();
  }

  /**
   * Broadcast "ada update" ke semua device (dipanggil GitHub Actions setelah
   * release). Public tapi di-guard header `x-announce-secret` — set
   * `ANNOUNCE_SECRET` di env server + sebagai GitHub secret.
   */
  @Public()
  @Post('announce')
  async announce(
    @Headers('x-announce-secret') secret: string | undefined,
    @Body() dto: { versionName?: string; notes?: string },
  ) {
    const expected = this.config.get<string>('ANNOUNCE_SECRET');
    if (!expected || secret !== expected) {
      throw new ForbiddenException('Invalid announce secret.');
    }
    await this.notifications.notifyUpdateAvailable(
      dto.versionName ?? 'terbaru',
      dto.notes,
    );
    return { ok: true };
  }
}
