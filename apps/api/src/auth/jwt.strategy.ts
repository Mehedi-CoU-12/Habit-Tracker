import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { CacheService } from '../redis/cache.service.js';
import { cacheKeys, TTL } from '../redis/cache-keys.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET') ?? '',
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    tokenVersion?: number;
    type?: string;
  }) {
    if (payload.type && payload.type !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.cache.getOrSet(
      cacheKeys.authUser(payload.sub),
      TTL.authUser,
      () =>
        this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            tokenVersion: true,
          },
        }),
    );
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session expired, please sign in again');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }
}
