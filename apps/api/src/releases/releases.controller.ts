import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Request,
} from '@nestjs/common';
import { AppPlatform, Role } from '../../generated/prisma/client.js';
import { Public } from '../auth/public.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { ReleasesService } from './releases.service.js';
import { UpsertReleaseDto } from './dto/upsert-release.dto.js';

type AuthedRequest = { user: { id: string } };

function parsePlatform(value: string | undefined): AppPlatform {
  const key = (value ?? 'android').toUpperCase();
  if (key === 'ANDROID' || key === 'IOS') return key;
  throw new BadRequestException('platform must be "android" or "ios"');
}

@Controller('app')
@Public()
export class AppVersionController {
  constructor(private readonly releases: ReleasesService) {}

  @Get('version')
  getVersion(@Query('platform') platform?: string) {
    return this.releases.getPublic(parsePlatform(platform));
  }
}

// The global guard stack already requires a valid token + ACTIVE account;
// @Roles(ADMIN) narrows these to admins (enforced by RolesGuard).
@Controller('admin/releases')
@Roles(Role.ADMIN)
export class AdminReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get()
  list() {
    return this.releases.listAll();
  }

  @Put(':platform')
  upsert(
    @Request() req: AuthedRequest,
    @Param('platform') platform: string,
    @Body() dto: UpsertReleaseDto,
  ) {
    return this.releases.upsert(req.user.id, parsePlatform(platform), dto);
  }
}
