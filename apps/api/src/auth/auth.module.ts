import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { GoogleStrategy } from './google.strategy.js';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        // Short-lived access token — the default for jwt.sign(). Refresh
        // tokens override this with a longer TTL (auth.service.ts). Kept short
        // so a leaked access token is only useful for minutes; sign-out /
        // password change revoke instantly via tokenVersion regardless.
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Only instantiate GoogleStrategy when credentials are configured.
    // passport-google-oauth20 throws at construction time if clientID is empty.
    {
      provide: 'GOOGLE_STRATEGY',
      useFactory: (config: ConfigService) => {
        if (!config.get<string>('GOOGLE_CLIENT_ID')) return null;
        return new GoogleStrategy(config);
      },
      inject: [ConfigService],
    },
  ],
  exports: [JwtModule],
})
export class AuthModule {}
