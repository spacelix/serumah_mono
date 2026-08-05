import { Module } from '@nestjs/common';
import { ListrikController } from './listrik.controller';
import { ListrikService } from './listrik.service';

@Module({
  controllers: [ListrikController],
  providers: [ListrikService],
  exports: [ListrikService],
})
export class ListrikModule {}
