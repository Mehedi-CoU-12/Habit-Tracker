import { Module } from '@nestjs/common';
import { HabitsModule } from '../habits/habits.module.js';
import { FocusController } from './focus.controller.js';
import { FocusService } from './focus.service.js';

@Module({
  // A session bound to a fillFromFocus habit writes its HabitLog here, so the
  // habits cache has to be invalidated through the owning service.
  imports: [HabitsModule],
  controllers: [FocusController],
  providers: [FocusService],
})
export class FocusModule {}
