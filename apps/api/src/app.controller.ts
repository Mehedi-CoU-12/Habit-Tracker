import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Lightweight liveness probe (no DB hit) for Render's health check and the
  // external keep-alive pinger that stops the free instance from sleeping.
  @Get('health')
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
