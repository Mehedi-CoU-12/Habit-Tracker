import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ActivityInterceptor } from './common/activity.interceptor.js';
import { ActivityService } from './common/activity.service.js';
import { ClientGuard } from './common/client.guard.js';
import { KeepAliveService } from './common/keep-alive.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { StatusGuard } from './auth/status.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { HabitsModule } from './habits/habits.module.js';
import { FocusModule } from './focus/focus.module.js';
import { NotesModule } from './notes/notes.module.js';
import { UsersModule } from './users/users.module.js';
import { AdminModule } from './admin/admin.module.js';
import { ReleasesModule } from './releases/releases.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    HabitsModule,
    FocusModule,
    NotesModule,
    UsersModule,
    AdminModule,
    ReleasesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    KeepAliveService,
    ActivityService,
    { provide: APP_GUARD, useClass: ClientGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: StatusGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Runs after the guards above, so req.user is populated.
    { provide: APP_INTERCEPTOR, useClass: ActivityInterceptor },
  ],
})
export class AppModule {}
