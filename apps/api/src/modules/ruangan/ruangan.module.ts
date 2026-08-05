import { Module } from '@nestjs/common';
import { RuanganController } from './ruangan.controller';
import { RuanganService } from './ruangan.service';

@Module({
  controllers: [RuanganController],
  providers: [RuanganService],
  exports: [RuanganService],
})
export class RuanganModule {}
