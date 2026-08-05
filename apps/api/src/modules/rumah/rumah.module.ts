import { Module } from '@nestjs/common';
import { RumahController } from './rumah.controller';
import { RumahService } from './rumah.service';

@Module({
  controllers: [RumahController],
  providers: [RumahService],
  exports: [RumahService],
})
export class RumahModule {}
