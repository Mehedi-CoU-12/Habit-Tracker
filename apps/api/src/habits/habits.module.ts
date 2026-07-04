import { Module } from '@nestjs/common';
import { HabitsController } from './habits.controller.js';
import { HabitsService } from './habits.service.js';

@Module({
  controllers: [HabitsController],
  providers: [HabitsService],
  // AdminModule reuses getHabitsWithLogs for the per-user progress view.
  exports: [HabitsService],
})
export class HabitsModule {}
