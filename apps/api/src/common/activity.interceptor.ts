import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { ActivityService } from './activity.service.js';

/**
 * Stamps `lastActiveAt` (and the client build) on every authenticated request.
 *
 * Registered globally, so it runs after the guard stack — which is what makes
 * `req.user` available here. That also means it only sees requests the guards
 * let through: a PENDING or SUSPENDED account still lands here via the
 * @AllowInactive routes it can reach (notably GET /users/me, which every
 * client polls on launch), so "opened the app" is recorded even for accounts
 * sitting in the approval queue.
 */
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
      // Deliberately before the handler runs and deliberately not awaited: the
      // user was here whether or not the request goes on to succeed.
      this.activity.touch(
        userId,
        req.header('x-app-version'),
        req.header('x-app-platform'),
      );
    }

    return next.handle();
  }
}
