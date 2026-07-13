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
