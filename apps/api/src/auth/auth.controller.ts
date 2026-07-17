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

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

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
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5000';
    res.redirect(
      `${frontendUrl}/auth/callback#token=${accessToken}&refresh=${refreshToken}`,
    );
  }

  /**
   * Step 3 (mobile only) — exchange the deep-link code for tokens + user.
   */
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('google/exchange')
  @HttpCode(HttpStatus.OK)
  googleExchange(@Body() dto: GoogleExchangeDto) {
    return this.authService.exchangeGoogleCode(dto.code);
  }
}
