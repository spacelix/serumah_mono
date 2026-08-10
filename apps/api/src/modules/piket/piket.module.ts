import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PiketController } from './piket.controller';
import { PiketService } from './piket.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PiketController],
  providers: [PiketService],
  exports: [PiketService],
})
export class PiketModule {}
