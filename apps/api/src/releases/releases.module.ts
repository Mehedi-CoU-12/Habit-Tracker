import { Module } from '@nestjs/common';
import {
  AdminReleasesController,
  AppVersionController,
} from './releases.controller.js';
import { ReleasesService } from './releases.service.js';

@Module({
  controllers: [AppVersionController, AdminReleasesController],
  providers: [ReleasesService],
})
export class ReleasesModule {}
