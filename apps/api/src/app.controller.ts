import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service.js';
import { RedisService } from './redis/redis.service.js';
import { SkipClientGuard } from './common/skip-client-guard.decorator.js';
import { Public } from './auth/public.decorator.js';

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
      redis: this.redisService.status,
    };
  }
}
