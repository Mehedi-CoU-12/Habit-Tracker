import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService) {}

  /** Public banner for anyone who opens the API's root URL. Nothing secret. */
  getRoot() {
    return {
      name: 'Habit Tracker API',
      status: 'ok',
      health: '/health',
      web: this.config.get<string>('FRONTEND_URL'),
    };
  }
}
