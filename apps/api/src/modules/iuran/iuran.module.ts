import { Module } from '@nestjs/common';
import { IuranController } from './iuran.controller';
import { IuranService } from './iuran.service';

@Module({
  controllers: [IuranController],
  providers: [IuranService],
  exports: [IuranService],
})
export class IuranModule {}
