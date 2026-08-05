import { Module } from '@nestjs/common';
import { PiketController } from './piket.controller';
import { PiketService } from './piket.service';

@Module({
  controllers: [PiketController],
  providers: [PiketService],
  exports: [PiketService],
})
export class PiketModule {}
