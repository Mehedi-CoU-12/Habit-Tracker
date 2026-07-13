import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service.js';
import { RedisService } from './redis/redis.service.js';
import { SkipClientGuard } from './common/skip-client-guard.decorator.js';
import { Public } from './auth/public.decorator.js';

// @Public: the health check must stay reachable by Render's probe and the
// keep-alive self-ping, neither of which carries a JWT.
@Controller()
@SkipClientGuard()
@Public()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @SkipThrottle()
  getHealth() {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      // 'ready' when caching is live, 'disabled' without REDIS_URL, anything
      // else means Redis is configured but unreachable (API still serves —
      // every read just falls through to Postgres).
      redis: this.redisService.status,
    };
  }
}
