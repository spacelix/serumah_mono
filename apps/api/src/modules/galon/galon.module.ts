import { Module } from '@nestjs/common';
import { GalonController } from './galon.controller';
import { GalonService } from './galon.service';

@Module({
  controllers: [GalonController],
  providers: [GalonService],
  exports: [GalonService],
})
export class GalonModule {}
