import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { GalonController } from './galon.controller';
import { GalonService } from './galon.service';

@Module({
  imports: [NotificationsModule],
  controllers: [GalonController],
  providers: [GalonService],
  exports: [GalonService],
})
export class GalonModule {}
