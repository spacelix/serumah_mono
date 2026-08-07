import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { CacheService } from './cache.service';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        const client = new Redis(url, { lazyConnect: true });
        client.on('error', (err) => {
          // Never crash the app on a Redis hiccup — log and move on.
          console.error('[Redis] connection error:', err.message);
        });
        return client;
      },
    },
    CacheService,
  ],
  exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule {}
