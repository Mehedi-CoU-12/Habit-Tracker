import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service.js';
import { CacheService } from './cache.service.js';

// Global for the same reason PrismaModule is: caching is cross-cutting and
// nearly every feature module needs CacheService for reads or invalidation.
@Global()
@Module({
  providers: [RedisService, CacheService],
  exports: [RedisService, CacheService],
})
export class RedisModule {}
