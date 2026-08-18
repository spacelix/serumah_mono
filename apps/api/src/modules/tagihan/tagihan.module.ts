import { Module } from '@nestjs/common';
import { TagihanController } from './tagihan.controller';
import { TagihanService } from './tagihan.service';

@Module({
  controllers: [TagihanController],
  providers: [TagihanService],
})
export class TagihanModule {}
