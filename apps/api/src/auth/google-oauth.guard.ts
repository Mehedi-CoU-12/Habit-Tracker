import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

/**
 * Google OAuth guard that round-trips which client (web or mobile) started
 * the flow via the OAuth `state` parameter, so the callback knows where to
 * send the result: the web SPA's /auth/callback or the app's deep link.
 */
@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    return { state: req.query.client === 'mobile' ? 'mobile' : 'web' };
  }
}
