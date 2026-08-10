import { Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { GalonService } from './galon.service';

@Controller('galon')
export class GalonController {
  constructor(private readonly galonService: GalonService) {}

  @Get('current')
  current(@CurrentUser() payload: CurrentUserPayload) {
    return this.galonService.current(payload);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() payload: CurrentUserPayload, @Param('id') id: string) {
    return this.galonService.confirm(payload, id);
  }

  @Post('nudge')
  nudge(@CurrentUser() payload: CurrentUserPayload) {
    return this.galonService.nudge(payload);
  }
}
