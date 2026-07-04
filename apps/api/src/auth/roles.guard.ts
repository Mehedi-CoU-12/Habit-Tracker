import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/prisma/client.js';
import { ROLES_KEY } from './roles.decorator.js';

/**
 * Enforces @Roles(...) metadata. Routes without the metadata pass untouched;
 * routes with it require the authenticated user's role to match. Runs after
 * JwtAuthGuard (so req.user is populated) and StatusGuard (so only ACTIVE
 * accounts get this far).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { role: Role } }>();
    if (user && required.includes(user.role)) return true;

    throw new ForbiddenException(
      'You do not have permission to access this resource.',
    );
  }
}
