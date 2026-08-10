import { forwardRef, Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { IuranController } from './iuran.controller';
import { IuranService } from './iuran.service';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [IuranController],
  providers: [IuranService],
  exports: [IuranService],
})
export class IuranModule {}
