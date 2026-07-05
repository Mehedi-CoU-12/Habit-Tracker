import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET') ?? '',
    });
  }

  /**
   * Re-reads the user on every request (one indexed PK lookup) so that role
   * and status are always current: an admin approving or suspending an
   * account takes effect on the holder's next request, and a deleted user's
   * token dies instantly — a signed JWT alone proves nothing about the
   * account's present state.
   *
   * The same lookup carries the revocation check: `tokenVersion` embedded in
   * the token must still match the user's, so sign-out / password change
   * (which bump the version) kill every outstanding token at once. A refresh
   * token is rejected here — only /auth/refresh may accept it.
   */
  async validate(payload: {
    sub: string;
    email: string;
    tokenVersion?: number;
    type?: string;
  }) {
    if (payload.type && payload.type !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        tokenVersion: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session expired, please sign in again');
    }

    // Deliberately omit tokenVersion from req.user — downstream guards and
    // controllers only need identity/role/status.
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }
}
