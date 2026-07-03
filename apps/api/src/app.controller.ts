import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service.js';
import { SkipClientGuard } from './common/skip-client-guard.decorator.js';
import { Public } from './auth/public.decorator.js';

// @Public: the health check must stay reachable by Render's probe and the
// keep-alive self-ping, neither of which carries a JWT.
@Controller()
@SkipClientGuard()
@Public()
export class AppController {
  constructor(private readonly appService: AppService) {}

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
    };
  }
}
