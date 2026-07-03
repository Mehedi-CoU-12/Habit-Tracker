import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ClientGuard } from './common/client.guard.js';
import { KeepAliveService } from './common/keep-alive.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { StatusGuard } from './auth/status.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { HabitsModule } from './habits/habits.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting: at most 120 requests per minute per client IP by default.
    // Individual routes can tighten (see @Throttle on auth) or opt out with
    // @SkipThrottle. Storage is in-memory — fine for a single instance; use a
    // shared store (e.g. Redis) if you scale to multiple instances.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    HabitsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    KeepAliveService,
    // Global guards run in registration order: reject non-app callers first,
    // rate-limit what remains, then authenticate (unless @Public), then
    // require an ACTIVE account (unless @AllowInactive), then check @Roles.
    // Locked by default: a new endpoint is protected without any decorator.
    { provide: APP_GUARD, useClass: ClientGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: StatusGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
