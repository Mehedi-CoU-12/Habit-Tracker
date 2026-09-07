import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CacheService } from '../redis/cache.service.js';
import { cacheKeys } from '../redis/cache-keys.js';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

// Refresh tokens outlive the short access token (see auth.module.ts, 15m).
// Both are signed with JWT_SECRET and told apart by the `type` claim: a
// refresh token can never authorize a normal request (JwtStrategy rejects
// type !== 'access') and an access token can never be refreshed (refresh()
// requires type === 'refresh').
const REFRESH_TOKEN_TTL = '30d';

// One-time code carried by the mobile Google sign-in deep link; only needs
// to survive the browser→app handoff, so keep it tight.
const GOOGLE_CODE_TTL = '60s';

// A reset link only has to survive the walk from the mail app to a browser.
// It is single-use on top of this (resetPassword stamps usedAt).
const RESET_TTL_MS = 30 * 60_000;

// Per-mailbox request cap. The route's @Throttle caps one IP; this caps one
// address however many IPs ask, so a reset can't be used to flood an inbox.
const RESET_WINDOW_MS = 15 * 60_000;
const RESET_MAX_PER_WINDOW = 3;

/** Only the hash is stored, so a leaked table can't be replayed as a reset. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** The fields every token embeds — id, email (access only), and the version. */
type TokenUser = { id: string; email: string; tokenVersion: number };

/** Profile shape GoogleStrategy.validate() extracts from Google's response. */
type GoogleUser = {
  googleId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

/** Minimal shape returned to clients alongside the tokens. */
type PublicUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly cache: CacheService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      // Signups are auto-approved — ACTIVE, not PENDING, so no admin step
      // stands between signing up and using the app. Set explicitly (the
      // column default says the same) so the behavior is visible here and
      // holds even on a database that predates that default. Comment this
      // line out to restore the manual approval gate.
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
        status: 'ACTIVE',
      },
    });
    // New accounts must show up in the admin's user list right away.
    await this.cache.bumpVersion(cacheKeys.adminUsersVersion);

    return { ...this.issueTokens(user), user: this.publicUser(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.password) {
      // No password means account was created via Google — must use Google sign-in
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = bcrypt.compareSync(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { ...this.issueTokens(user), user: this.publicUser(user) };
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, email: true, password: true },
    });
    if (!user) return { sent: true };

    if (!user.password) {
      void this.mail.send(user.email, 'password-reset-google', {
        name: user.name,
        loginUrl: `${this.frontendUrl()}/login`,
      });
      return { sent: true };
    }

    const now = new Date();
    const recent = await this.prisma.passwordResetToken.count({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(now.getTime() - RESET_WINDOW_MS) },
      },
    });
    if (recent >= RESET_MAX_PER_WINDOW) return { sent: true };

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
      data: { expiresAt: now },
    });

    const token = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + RESET_TTL_MS),
      },
    });

    // Dispatched, not awaited: the response time must not depend on whether
    // there was an address to mail, or D1.2 leaks through the clock. `send`
    // never rejects, so nothing here can become an unhandled rejection.
    void this.mail.send(user.email, 'password-reset', {
      name: user.name,
      url: `${this.frontendUrl()}/reset-password?token=${token}`,
      expiresInMinutes: RESET_TTL_MS / 60_000,
    });

    return { sent: true };
  }

  /**
   * Consume a reset link and set the new password. Bumps tokenVersion: the
   * likeliest reason for a reset is that someone else knows the old password,
   * so every existing session on every device dies here.
   */
  async resetPassword(dto: ResetPasswordDto) {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(dto.token) },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        user: { select: { email: true } },
      },
    });

    const now = new Date();
    // Unknown, used and expired share one message — which of the three it was
    // is information only an attacker probing tokens benefits from.
    if (!row || row.usedAt || row.expiresAt <= now) {
      throw new BadRequestException('This reset link is invalid or expired');
    }

    const password = await bcrypt.hash(dto.password, 10);
    await this.prisma.transaction(async (tx) => {
      // Conditional claim: two requests racing the same link, one winner.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: row.id, usedAt: null },
        data: { usedAt: now },
      });
      if (claimed.count === 0) {
        throw new BadRequestException('This reset link is invalid or expired');
      }
      await tx.user.update({
        where: { id: row.userId },
        data: { password, tokenVersion: { increment: 1 } },
      });
    });

    // The bumped tokenVersion only bites once the cached auth row is gone;
    // the profile cache carries hasPassword, so it goes too.
    await this.cache.del(
      cacheKeys.authUser(row.userId),
      cacheKeys.me(row.userId),
    );

    // Returned so the client can sign straight in. Learning it requires a
    // valid link, which was mailed to that address in the first place.
    return { success: true, email: row.user.email };
  }

  private frontendUrl() {
    return (
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5000'
    ).replace(/\/+$/, '');
  }

  async googleLogin(googleUser: GoogleUser) {
    const user = await this.upsertGoogleUser(googleUser);
    return this.issueTokens(user);
  }

  /**
   * Mobile variant of googleLogin. The callback redirect for mobile is a
   * habitflow:// deep link, which any installed app could register to
   * intercept — so instead of tokens it carries a single-purpose 60s code
   * that the app exchanges for tokens over HTTPS (see exchangeGoogleCode).
   */
  async googleLoginCode(googleUser: GoogleUser) {
    const user = await this.upsertGoogleUser(googleUser);
    return this.jwt.sign(
      { sub: user.id, type: 'google_code' },
      { expiresIn: GOOGLE_CODE_TTL },
    );
  }

  /** Trade a deep-link code for the same payload login/signup return. */
  async exchangeGoogleCode(code: string) {
    let payload: { sub: string; type?: string };
    try {
      payload = this.jwt.verify(code);
    } catch {
      throw new UnauthorizedException('Invalid or expired sign-in code');
    }
    if (payload.type !== 'google_code') {
      throw new UnauthorizedException('Invalid or expired sign-in code');
    }

    // Best-effort single-use: with Redis up a replayed code dies here;
    // without Redis the 60s expiry still bounds the window.
    const usedKey = cacheKeys.googleCodeUsed(code);
    if (await this.cache.get(usedKey)) {
      throw new UnauthorizedException('Invalid or expired sign-in code');
    }
    await this.cache.set(usedKey, 1, 120);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }
    return { ...this.issueTokens(user), user: this.publicUser(user) };
  }

  private async upsertGoogleUser(googleUser: GoogleUser) {
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (user) {
      // Link googleId if not already linked
      if (!user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: googleUser.googleId,
            avatarUrl: user.avatarUrl ?? googleUser.avatarUrl,
          },
        });
      }
    } else {
      user = await this.prisma.user.create({
        // Same as signup: first-time Google sign-in is auto-approved.
        // Comment out `status` to restore the manual approval gate.
        data: {
          name: googleUser.name,
          email: googleUser.email,
          googleId: googleUser.googleId,
          avatarUrl: googleUser.avatarUrl,
          status: 'ACTIVE',
        },
      });
      // Same as signup: surface the new account in the admin list now.
      await this.cache.bumpVersion(cacheKeys.adminUsersVersion);
    }

    return user;
  }

  /**
   * Exchange a valid refresh token for a fresh access+refresh pair (sliding
   * expiry). Rejects if the token isn't a refresh token, the user is gone, or
   * its tokenVersion has been bumped since (sign-out / password change) — in
   * which case the client must sign in again.
   *
   * Deliberately reads the user straight from Postgres, never the cache:
   * this runs a few times an hour per client, and minting new long-lived
   * tokens off a stale tokenVersion is the one mistake the cache must never
   * be able to make.
   */
  async refresh(refreshToken: string) {
    let payload: { sub: string; tokenVersion: number; type?: string };
    try {
      payload = this.jwt.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, tokenVersion: true },
    });
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session expired, please sign in again');
    }

    return this.issueTokens(user);
  }

  /**
   * Sign out of ALL sessions: bumping tokenVersion invalidates every access
   * and refresh token this user currently holds. Idempotent — an invalid or
   * expired token simply has nothing to revoke, so it still returns success
   * (the client clears its local tokens regardless).
   */
  async logout(refreshToken: string) {
    try {
      const payload = this.jwt.verify<{ sub: string; type?: string }>(
        refreshToken,
      );
      if (payload.type === 'refresh') {
        // updateMany (not update) so a since-deleted user is a no-op, not a throw.
        await this.prisma.user.updateMany({
          where: { id: payload.sub },
          data: { tokenVersion: { increment: 1 } },
        });
        // Drop the cached auth row so every token dies on its next use, not
        // when the cache TTL expires.
        await this.cache.del(cacheKeys.authUser(payload.sub));
      }
    } catch {
      /* unverifiable token — nothing to revoke */
    }
    return { success: true };
  }

  private issueTokens(user: TokenUser) {
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
      type: 'access',
    });
    const refreshToken = this.jwt.sign(
      { sub: user.id, tokenVersion: user.tokenVersion, type: 'refresh' },
      { expiresIn: REFRESH_TOKEN_TTL },
    );
    return { accessToken, refreshToken };
  }

  private publicUser(user: PublicUser): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
    };
  }
}
