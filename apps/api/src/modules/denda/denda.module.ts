import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { DendaController } from './denda.controller';
import { DendaService } from './denda.service';

@Module({
  imports: [NotificationsModule],
  controllers: [DendaController],
  providers: [DendaService],
  exports: [DendaService],
})
export class DendaModule {}
