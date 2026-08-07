import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { LogFlushProcessor, LOG_FLUSH_QUEUE } from './log-flush.processor';
import { LogViewerService } from './logviewer.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        },
      }),
    }),
    BullModule.registerQueue({ name: LOG_FLUSH_QUEUE }),
  ],
  controllers: [AdminController],
  providers: [LogViewerService, LogFlushProcessor],
})
export class LogViewerModule {}
