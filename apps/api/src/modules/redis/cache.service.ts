import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

export type CacheValue = Record<string, unknown>;

/**
 * Read-through cache for referential Beranda/Profile data that changes rarely
 * and is read often. Keys are `cache:{scope}:{resource}` with a short TTL.
 * Callers are responsible for invalidating on the corresponding mutation.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(scope: string, resource: string): string {
    return `cache:${scope}:${resource}`;
  }

  async get<T = CacheValue>(
    scope: string,
    resource: string,
  ): Promise<T | null> {
    try {
      const raw = await this.redis.get(this.key(scope, resource));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      this.logger.warn(`get failed for ${scope}:${resource}: ${String(err)}`);
      return null;
    }
  }

  async set(
    scope: string,
    resource: string,
    value: unknown,
    ttlSeconds = 60,
  ): Promise<void> {
    try {
      await this.redis.set(
        this.key(scope, resource),
        JSON.stringify(value),
        'EX',
        ttlSeconds,
      );
    } catch (err) {
      this.logger.warn(`set failed for ${scope}:${resource}: ${String(err)}`);
    }
  }

  async invalidate(scope: string, resource: string): Promise<void> {
    try {
      await this.redis.del(this.key(scope, resource));
    } catch (err) {
      this.logger.warn(
        `invalidate failed for ${scope}:${resource}: ${String(err)}`,
      );
    }
  }

  /** Hapus satu key langsung (di luar pola scope/resource). */
  async del(rawKey: string): Promise<void> {
    try {
      await this.redis.del(rawKey);
    } catch (err) {
      this.logger.warn(`del failed for ${rawKey}: ${String(err)}`);
    }
  }

  /** Invalidate every key belonging to a scope (e.g. a whole rumah). */
  async invalidateScope(scope: string): Promise<void> {
    try {
      const pattern = `cache:${scope}:*`;
      const keys: string[] = [];
      const stream = this.redis.scanStream({ match: pattern, count: 100 });
      for await (const batch of stream) {
        keys.push(...(batch as string[]));
      }
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      this.logger.warn(`invalidateScope failed for ${scope}: ${String(err)}`);
    }
  }
}
