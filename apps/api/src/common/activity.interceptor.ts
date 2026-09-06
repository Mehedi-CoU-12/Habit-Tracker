import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { ActivityService } from './activity.service.js';

@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(private readonly activity: ActivityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { id?: string } }>();
    const userId = req.user?.id;
    if (userId) {
      this.activity.touch(
        userId,
        req.header('x-app-version'),
        req.header('x-app-platform'),
      );
    }

    return next.handle();
  }
}
