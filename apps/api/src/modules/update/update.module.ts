import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { UpdateController } from './update.controller';
import { UpdateService } from './update.service';

@Module({
  imports: [NotificationsModule],
  controllers: [UpdateController],
  providers: [UpdateService],
  exports: [UpdateService],
})
export class UpdateModule {}
