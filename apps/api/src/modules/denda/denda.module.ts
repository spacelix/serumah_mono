import { Module } from '@nestjs/common';
import { DendaController } from './denda.controller';
import { DendaService } from './denda.service';

@Module({
  controllers: [DendaController],
  providers: [DendaService],
  exports: [DendaService],
})
export class DendaModule {}
