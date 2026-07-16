import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { CacheService } from '../redis/cache.service.js';
import { cacheKeys } from '../redis/cache-keys.js';
import { SignupDto } from './dto/signup.dto.js';
import { LoginDto } from './dto/login.dto.js';

// Refresh tokens outlive the short access token (see auth.module.ts, 15m).
// Both are signed with JWT_SECRET and told apart by the `type` claim: a
// refresh token can never authorize a normal request (JwtStrategy rejects
// type !== 'access') and an access token can never be refreshed (refresh()
// requires type === 'refresh').
const REFRESH_TOKEN_TTL = '30d';

// One-time code carried by the mobile Google sign-in deep link; only needs
// to survive the browser→app handoff, so keep it tight.
const GOOGLE_CODE_TTL = '60s';

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
      data: { name: dto.name, email: dto.email, password: hashed },
    });
    // New PENDING accounts must show up in the admin's user list right away.
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
        data: {
          name: googleUser.name,
          email: googleUser.email,
          googleId: googleUser.googleId,
          avatarUrl: googleUser.avatarUrl,
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
