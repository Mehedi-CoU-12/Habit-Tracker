import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AccountStatus } from '../../generated/prisma/client.js';
import { IS_PUBLIC } from './public.decorator.js';
import { ALLOW_INACTIVE } from './allow-inactive.decorator.js';

/**
 * Blocks every authenticated request whose account is not ACTIVE, so a
 * PENDING signup (or a suspension) takes effect on the very next request —
 * the JWT strategy re-reads the user from the DB per request, so no stale
 * 7-day token can outlive an admin's decision.
 *
 * The 403 carries a machine-readable `code` (ACCOUNT_PENDING /
 * ACCOUNT_SUSPENDED) that web and mobile use to route to their
 * "waiting for approval" screens. Deliberately not a 401: the web client
 * treats 401 as "session dead" (wipes the token, redirects to login).
 */
@Injectable()
export class StatusGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_INACTIVE, targets)) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { status: AccountStatus } }>();
    // No user attached means the route is public by other means; missing or
    // invalid tokens are JwtAuthGuard's job (401), not ours.
    if (!user) return true;
    if (user.status === 'ACTIVE') return true;

    throw new ForbiddenException({
      error: 'Forbidden',
      message:
        user.status === 'PENDING'
          ? 'Your account is awaiting approval.'
          : 'Your account has been suspended.',
      code: user.status === 'PENDING' ? 'ACCOUNT_PENDING' : 'ACCOUNT_SUSPENDED',
    });
  }
}
