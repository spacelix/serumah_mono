import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Observable, tap } from 'rxjs';
import { REDIS_CLIENT } from '../../modules/redis/redis.module';

export interface LogEntryPayload {
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId: string | null;
  ip: string | null;
  isError: boolean;
  errorMessage: string | null;
}

/**
 * Global request logger. Buffers one entry per request into the Redis list
 * `log:buffer` (microseconds, never blocks). A BullMQ job drains the list into
 * the `log_entries` Postgres table every 5 minutes. Any Redis failure is caught
 * so logging can never break a request.
 */
@Injectable()
export class LoggerInterceptor implements NestInterceptor {
  private readonly bufferKey = 'log:buffer';
  private readonly skipPrefixes: string[];

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    const prefix = this.config.get<string>('GLOBAL_PREFIX') ?? 'api';
    this.skipPrefixes = [
      `/${prefix}/health`,
      `/${prefix}/update/manifest`,
      `/${prefix}/admin`,
    ];
  }

  private shouldSkip(path: string): boolean {
    return this.skipPrefixes.some((p) => path.startsWith(p));
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      originalUrl?: string;
      url?: string;
      ip?: string;
      user?: { id?: string } | null;
    }>();
    const http = context.switchToHttp();
    const response = http.getResponse<{ statusCode?: number }>();

    const path = request.originalUrl ?? request.url ?? '';
    if (this.shouldSkip(path)) {
      return next.handle();
    }

    const startedAt = Date.now();
    const method = request.method;
    const ip = request.ip ?? null;
    const userId = request.user?.id ?? null;

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = response.statusCode ?? 200;
          const entry = this.buildEntry({
            method,
            path,
            statusCode,
            durationMs: Date.now() - startedAt,
            userId,
            ip,
          });
          void this.push(entry);
        },
        error: (err: unknown) => {
          const statusCode =
            (err as { status?: number } | null)?.status ??
            response.statusCode ??
            500;
          const errorMessage =
            err instanceof Error ? err.message.slice(0, 500) : null;
          const entry = this.buildEntry({
            method,
            path,
            statusCode,
            durationMs: Date.now() - startedAt,
            userId,
            ip,
            errorMessage,
          });
          void this.push(entry);
        },
      }),
    );
  }

  private buildEntry(input: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    userId: string | null;
    ip: string | null;
    errorMessage?: string | null;
  }): LogEntryPayload {
    const isError = input.statusCode >= 400;
    return {
      timestamp: new Date().toISOString(),
      method: input.method,
      path: input.path,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      userId: input.userId,
      ip: input.ip,
      isError,
      errorMessage: isError ? (input.errorMessage ?? null) : null,
    };
  }

  private async push(entry: LogEntryPayload): Promise<void> {
    try {
      await this.redis.rpush(this.bufferKey, JSON.stringify(entry));
    } catch {
      // Swallow — logging must never fail the request.
    }
  }
}
