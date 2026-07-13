import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.log('REDIS_URL not set — caching disabled');
      return;
    }

    this.client = new Redis(url, {
      // All cache keys live under one namespace so a shared Redis (or a
      // FLUSHDB-averse hosted one) can be swept with a single pattern.
      keyPrefix: 'ht:',
      // Fail fast instead of queueing commands while disconnected: a cache
      // miss costs one Postgres query, a hung request costs the user.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      // Keep reconnecting forever, but back off to 30s so a dead Redis
      // doesn't spam logs or CPU.
      retryStrategy: (times) => Math.min(times * 500, 30_000),
      lazyConnect: false,
    });

    this.client.on('ready', () => this.logger.log('Redis connected'));
    this.client.on('error', (err: Error) => {
      // ioredis emits an error per failed attempt; log the message only
      // (no stack) to keep a prolonged outage readable.
      this.logger.warn(`Redis error: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    // quit() waits for a reply; if Redis is unreachable just tear down.
    try {
      await this.client?.quit();
    } catch {
      this.client?.disconnect();
    }
  }

  /** The live client, or null when caching is disabled/unavailable. */
  getClient(): Redis | null {
    if (!this.client || this.client.status !== 'ready') return null;
    return this.client;
  }

  /** For the health endpoint: 'disabled' | ioredis status ('ready', ...). */
  get status(): string {
    return this.client?.status ?? 'disabled';
  }
}
