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

const REFRESH_TOKEN_TTL = '30d';

/** The fields every token embeds — id, email (access only), and the version. */
type TokenUser = { id: string; email: string; tokenVersion: number };

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

  async googleLogin(googleUser: {
    googleId: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  }) {
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

    return this.issueTokens(user);
  }

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

  async logout(refreshToken: string) {
    try {
      const payload = this.jwt.verify<{ sub: string; type?: string }>(
        refreshToken,
      );
      if (payload.type === 'refresh') {
        await this.prisma.user.updateMany({
          where: { id: payload.sub },
          data: { tokenVersion: { increment: 1 } },
        });
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
