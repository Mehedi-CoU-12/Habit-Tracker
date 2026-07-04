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
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SkipClientGuard } from '../common/skip-client-guard.decorator.js';
import { Public } from './public.decorator.js';

/**
 * Shape that Passport's Google strategy attaches to the request.
 * Mirrors what `GoogleStrategy.validate()` passes to `done()`
 * (see google.strategy.ts).
 */
interface GoogleAuthRequest {
  user: {
    googleId: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
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

  /** Step 1 — redirect the browser to Google */
  @SkipClientGuard()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Passport handles the redirect automatically
  }

  /** Step 2 — Google redirects here after the user consents */
  @SkipClientGuard()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: GoogleAuthRequest, @Res() res: Response) {
    const { accessToken } = await this.authService.googleLogin(req.user);
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    // Fragment (#) instead of query (?): fragments never leave the browser,
    // so the token stays out of server/proxy request logs.
    res.redirect(`${frontendUrl}/auth/callback#token=${accessToken}`);
  }
}
