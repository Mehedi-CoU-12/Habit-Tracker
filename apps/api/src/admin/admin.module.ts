import { Module } from '@nestjs/common';
import { HabitsModule } from '../habits/habits.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  // HabitsModule exports HabitsService so admin progress views return the
  // exact same payload as a user's own GET /habits (D7).
  imports: [HabitsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
