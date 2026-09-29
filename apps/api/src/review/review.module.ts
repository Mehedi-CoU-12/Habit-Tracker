import { Module } from '@nestjs/common';
import { HabitsModule } from '../habits/habits.module.js';
import { MailModule } from '../mail/mail.module.js';
import { WeeklyReviewScheduler } from './weekly-review.scheduler.js';

@Module({
  imports: [HabitsModule, MailModule],
  providers: [WeeklyReviewScheduler],
})
export class ReviewModule {}
