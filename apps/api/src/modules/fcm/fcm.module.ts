import { Module } from '@nestjs/common';
import { PushTokenController } from './push-token.controller';
import { FcmService } from './fcm.service';

@Module({
  controllers: [PushTokenController],
  providers: [FcmService],
  exports: [FcmService],
})
export class FcmModule {}
