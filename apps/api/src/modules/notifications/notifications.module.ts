import { Module } from '@nestjs/common';
import { FcmModule } from '../fcm/fcm.module';
import { IuranModule } from '../iuran/iuran.module';
import { NotificationsCronService } from './notifications-cron.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [FcmModule, IuranModule],
  providers: [NotificationsService, NotificationsCronService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
