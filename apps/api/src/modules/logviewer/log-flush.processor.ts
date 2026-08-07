import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { LogViewerService } from './logviewer.service';

export const LOG_FLUSH_QUEUE = 'log-flush';
export const LOG_FLUSH_EVERY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * BullMQ worker that drains the Redis log buffer into Postgres. A repeatable
 * job is scheduled on module init (every 5 minutes); on a failed flush the job
 * retries via BullMQ backoff, keeping the buffer intact for the next attempt.
 */
@Processor(LOG_FLUSH_QUEUE)
export class LogFlushProcessor extends WorkerHost {
  private readonly logger = new Logger(LogFlushProcessor.name);

  constructor(
    private readonly logViewer: LogViewerService,
    @InjectQueue(LOG_FLUSH_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.scheduleRepeatableJob();
  }

  private async scheduleRepeatableJob(): Promise<void> {
    try {
      const schedulerId = 'log-flush-every-5m';
      await this.queue.upsertJobScheduler(
        schedulerId,
        { every: LOG_FLUSH_EVERY_MS },
        {
          opts: { attempts: 3, backoff: { type: 'exponential', delay: 30000 } },
        },
      );
      this.logger.log(
        `[LogFlushProcessor] scheduled flush job every ${LOG_FLUSH_EVERY_MS / 60000} min`,
      );
    } catch (err) {
      this.logger.error(
        `[LogFlushProcessor] failed to schedule flush job: ${String(err)}`,
      );
    }
  }

  async process(): Promise<void> {
    try {
      const result = await this.logViewer.flushBuffer();
      if (result.flushed > 0) {
        this.logger.log(
          `[LogFlushProcessor] flushed ${result.flushed} log entries`,
        );
      }
    } catch (err) {
      this.logger.error(`[LogFlushProcessor] flush failed: ${String(err)}`);
      throw err;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.warn(
      `[LogFlushProcessor] job failed after ${job.attemptsMade} attempts: ${err.message}`,
    );
  }
}
