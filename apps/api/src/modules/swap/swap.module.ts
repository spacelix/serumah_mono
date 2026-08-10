import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SwapController } from './swap.controller';
import { SwapService } from './swap.service';

@Module({
  imports: [NotificationsModule],
  controllers: [SwapController],
  providers: [SwapService],
  exports: [SwapService],
})
export class SwapModule {}
