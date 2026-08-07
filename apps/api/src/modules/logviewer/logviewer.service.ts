import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@serumah/db/prisma';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import type { LogEntryPayload } from '../../common/interceptors/logger.interceptor';

export interface StatsResponse {
  total: number;
  errors: number;
  errorRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
  topPaths: { path: string; count: number }[];
  perDay: { day: string; count: number }[];
}

export interface LogsResponse {
  items: LogEntryPayload[];
  total: number;
  page: number;
}

@Injectable()
export class LogViewerService {
  private readonly logger = new Logger(LogViewerService.name);
  private readonly bufferKey = 'log:buffer';

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  /** Drain the Redis buffer atomically and bulk-insert into Postgres. */
  async flushBuffer(): Promise<{ flushed: number }> {
    const processingKey = `${this.bufferKey}:processing`;

    // Atomically claim the buffer via RENAME. If the buffer key is missing
    // (nothing to flush, or another worker already claimed it) RENAME throws —
    // treat that as "nothing to do" so concurrent workers never double-insert.
    let claimed: unknown;
    try {
      claimed = await this.redis.rename(this.bufferKey, processingKey);
    } catch {
      return { flushed: 0 };
    }
    if (claimed !== 'OK') {
      return { flushed: 0 };
    }

    try {
      const entries = await this.redis.lrange(processingKey, 0, -1);
      const parsed = entries
        .map((raw) => {
          try {
            return JSON.parse(raw) as LogEntryPayload;
          } catch {
            return null;
          }
        })
        .filter((e): e is LogEntryPayload => e !== null);

      if (parsed.length > 0) {
        await this.prisma.logEntry.createMany({
          data: parsed.map((e) => ({
            timestamp: new Date(e.timestamp),
            method: e.method,
            path: e.path,
            statusCode: e.statusCode,
            durationMs: e.durationMs,
            userId: e.userId,
            ip: e.ip,
            isError: e.isError,
            errorMessage: e.errorMessage,
          })),
        });
      }
      await this.redis.del(processingKey);
      return { flushed: parsed.length };
    } catch (err) {
      // Restore the buffer for the next flush attempt (data not lost).
      await this.redis.rename(processingKey, this.bufferKey).catch(() => {});
      this.logger.error(`[LogViewerService] flush failed: ${String(err)}`);
      throw err;
    }
  }

  async stats(days = 7): Promise<StatsResponse> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [total, errors, durationAgg] = await Promise.all([
      this.prisma.logEntry.count({ where: { timestamp: { gte: since } } }),
      this.prisma.logEntry.count({
        where: { timestamp: { gte: since }, isError: true },
      }),
      this.prisma.logEntry.findMany({
        where: { timestamp: { gte: since } },
        select: { durationMs: true },
      }),
    ]);

    const durations = durationAgg
      .map((d) => d.durationMs)
      .sort((a, b) => a - b);
    const avgDurationMs =
      durations.length > 0
        ? Math.round(
            durations.reduce((acc, d) => acc + d, 0) / durations.length,
          )
        : 0;
    const p95DurationMs = this.p95(durations);

    const topPaths = await this.prisma.logEntry.groupBy({
      by: ['path'],
      where: { timestamp: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { path: 'desc' } },
      take: 10,
    });

    const perDayRows = await this.prisma.logEntry.groupBy({
      by: ['timestamp'],
      where: { timestamp: { gte: since } },
      _count: { _all: true },
    });

    const perDayMap = new Map<string, number>();
    for (const row of perDayRows) {
      const day = new Date(row.timestamp).toISOString().slice(0, 10);
      perDayMap.set(day, (perDayMap.get(day) ?? 0) + row._count._all);
    }
    const perDay = Array.from(perDayMap.entries()).map(([day, count]) => ({
      day,
      count,
    }));

    return {
      total,
      errors,
      errorRate: total > 0 ? Math.round((errors / total) * 1000) / 10 : 0,
      avgDurationMs,
      p95DurationMs,
      topPaths: topPaths.map((t) => ({ path: t.path, count: t._count._all })),
      perDay,
    };
  }

  async logs(query: {
    limit?: number;
    page?: number;
    method?: string;
    status?: string;
    search?: string;
  }): Promise<LogsResponse> {
    const limit = Math.min(Number(query.limit) || 50, 200);
    const page = Math.max(Number(query.page) || 1, 1);
    const where: {
      method?: { equals: string };
      statusCode?: { equals: number };
      OR?: { path: { contains: string; mode: 'insensitive' } }[];
    } = {};

    if (query.method) where.method = { equals: query.method.toUpperCase() };
    if (query.status) {
      const status = Number(query.status);
      if (Number.isInteger(status)) {
        where.statusCode = { equals: status };
      }
    }
    if (query.search) {
      where.OR = [{ path: { contains: query.search, mode: 'insensitive' } }];
    }

    const [items, total] = await Promise.all([
      this.prisma.logEntry.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.logEntry.count({ where }),
    ]);

    return {
      items: items.map((e) => ({
        timestamp: e.timestamp.toISOString(),
        method: e.method,
        path: e.path,
        statusCode: e.statusCode,
        durationMs: e.durationMs,
        userId: e.userId,
        ip: e.ip,
        isError: e.isError,
        errorMessage: e.errorMessage,
      })),
      total,
      page,
    };
  }

  private p95(sorted: number[]): number {
    if (sorted.length === 0) return 0;
    const idx = Math.min(
      sorted.length - 1,
      Math.ceil(sorted.length * 0.95) - 1,
    );
    return sorted[idx];
  }
}
