import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { GoogleExchangeDto } from './dto/google-exchange.dto.js';
import { GoogleOAuthGuard } from './google-oauth.guard.js';
import { SkipClientGuard } from '../common/skip-client-guard.decorator.js';
import { Public } from './public.decorator.js';

/**
 * Shape that Passport's Google strategy attaches to the request.
 * Mirrors what `GoogleStrategy.validate()` passes to `done()`
 * (see google.strategy.ts). `state` is the client marker the
 * GoogleOAuthGuard round-tripped through Google.
 */
interface GoogleAuthRequest {
  user: {
    googleId: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  query: { state?: string };
}

// @Public: these are the routes that *issue* tokens — the global JwtAuthGuard
// must not demand one here. Google's redirects also run without our JWT.
@Controller('auth')
@Public()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // Tighter limit than the global default: credential endpoints are the prime
  // brute-force target, so cap at 10 attempts/minute per IP.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * Exchange a refresh token for a fresh access+refresh pair. Public (the
   * access token is expired by the time a client refreshes) but still behind
   * the ClientGuard — web via Origin, mobile via x-app-client.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  /**
   * Sign out of all sessions by bumping the user's tokenVersion. Takes the
   * refresh token (not the access token) so it works even after the access
   * token has expired. Idempotent.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }

  /**
   * Step 1 — redirect the browser to Google. Mobile opens this with
   * `?client=mobile`, which the guard round-trips via OAuth `state`.
   */
  @SkipClientGuard()
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  googleAuth() {
    // Passport handles the redirect automatically
  }

  /** Step 2 — Google redirects here after the user consents */
  @SkipClientGuard()
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleCallback(@Req() req: GoogleAuthRequest, @Res() res: Response) {
    if (req.query.state === 'mobile') {
      // Deep links are interceptable by other installed apps, so this carries
      // only a 60s one-time code — the app trades it for tokens over HTTPS
      // at /auth/google/exchange.
      const code = await this.authService.googleLoginCode(req.user);
      const deepLink =
        this.config.get<string>('MOBILE_GOOGLE_REDIRECT') ??
        'habitflow://google-auth';
      return res.redirect(`${deepLink}?code=${code}`);
    }

    const { accessToken, refreshToken } = await this.authService.googleLogin(
      req.user,
    );
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    // Fragment (#) instead of query (?): fragments never leave the browser,
    // so the tokens stay out of server/proxy request logs.
    res.redirect(
      `${frontendUrl}/auth/callback#token=${accessToken}&refresh=${refreshToken}`,
    );
  }

  /**
   * Step 3 (mobile only) — exchange the deep-link code for tokens + user.
   * Behind the ClientGuard like the rest of the mobile API surface.
   */
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('google/exchange')
  @HttpCode(HttpStatus.OK)
  googleExchange(@Body() dto: GoogleExchangeDto) {
    return this.authService.exchangeGoogleCode(dto.code);
  }
}
