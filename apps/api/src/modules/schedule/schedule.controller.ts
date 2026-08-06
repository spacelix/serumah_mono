import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScheduleService } from './schedule.service';
import { WeekendStatusDto } from './dto/schedule.dto';

@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('week')
  getWeek(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('monday') monday?: string,
  ) {
    return this.scheduleService.getWeek(payload, monday);
  }

  @Post('generate/weekday')
  @Roles('admin')
  generateWeekday(@CurrentUser() payload: CurrentUserPayload) {
    return this.scheduleService.generateWeekday(payload);
  }

  @Post('generate/weekend')
  @Roles('admin')
  generateWeekend(@CurrentUser() payload: CurrentUserPayload) {
    return this.scheduleService.generateWeekend(payload);
  }

  @Put('weekend-status')
  setWeekendStatus(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: WeekendStatusDto,
  ) {
    return this.scheduleService.setWeekendStatus(payload, dto);
  }

  @Post('run-auto-fine')
  @Roles('admin')
  runAutoFine(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('tanggal') tanggal?: string,
  ) {
    return this.scheduleService.runAutoFine(payload, tanggal);
  }

  @Post('run-weekend-freeze')
  @Roles('admin')
  runWeekendFreeze(@CurrentUser() payload: CurrentUserPayload) {
    return this.scheduleService.runWeekendFreeze(payload);
  }
}
