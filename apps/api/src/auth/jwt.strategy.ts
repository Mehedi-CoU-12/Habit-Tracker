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
   * token dies instantly — a signed 7-day JWT alone proves nothing about
   * the account's present state.
   */
  async validate(payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, status: true },
    });
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }
    return user;
  }
}
