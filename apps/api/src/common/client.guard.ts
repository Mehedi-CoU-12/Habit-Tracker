import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { isAllowedOrigin } from './allowed-origins.js';
import { SKIP_CLIENT_GUARD } from './skip-client-guard.decorator.js';

/**
 * Ensures requests originate from one of our own clients rather than an
 * arbitrary tool (Postman, curl, a scraper). A request passes when EITHER:
 *
 *   - it carries `x-app-client: <APP_CLIENT_KEY>` (how the mobile app and any
 *     no-Origin client identifies itself), OR
 *   - it comes from an allow-listed browser Origin/Referer (the web app).
 *
 * This is a deterrent, not a cryptographic boundary: a key shipped inside a
 * public web/mobile bundle can be extracted by a determined attacker, and an
 * Origin header can be spoofed by a non-browser client. The real
 * authorization is the JWT (JwtAuthGuard) — this layer just keeps casual
 * Postman/script traffic out.
 *
 * Disabled (allows everything, logs one warning) until APP_CLIENT_KEY is set,
 * so deployments that haven't configured it yet keep working.
 */
@Injectable()
export class ClientGuard implements CanActivate {
  private readonly logger = new Logger(ClientGuard.name);
  private warnedDisabled = false;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CLIENT_GUARD, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const expectedKey = process.env.APP_CLIENT_KEY?.trim();
    if (!expectedKey) {
      if (!this.warnedDisabled) {
        this.warnedDisabled = true;
        this.logger.warn(
          'APP_CLIENT_KEY is not set — client verification is DISABLED. ' +
            'Set it to block non-app (e.g. Postman) requests.',
        );
      }
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();

    const key = req.header('x-app-client');
    if (key && timingSafeEqual(key, expectedKey)) return true;

    // Browsers always send Origin on cross-origin requests; fall back to the
    // Referer host for the rare navigations that omit Origin.
    const origin = req.header('origin') ?? originOf(req.header('referer'));
    if (isAllowedOrigin(origin)) return true;

    throw new ForbiddenException('Request not permitted from this client.');
  }
}

function originOf(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

/** Constant-time string compare to avoid leaking the key via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
