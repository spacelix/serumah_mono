import { Module } from '@nestjs/common';
import { ScheduleModule } from '../schedule/schedule.module';
import { GalonModule } from '../galon/galon.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ScheduleModule, GalonModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
