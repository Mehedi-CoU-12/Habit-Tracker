import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HabitsService } from '../habits/habits.service.js';
import { isoOfIndex, localClock, reviewWeekStart } from '../habits/progress.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Local hour on Sunday from which the review goes out. */
export const SEND_HOUR = 18;

const TICK_MS = 30 * 60 * 1000;
const FIRST_TICK_MS = 60 * 1000;

/** The week a user is due a review for right now (their local Sunday evening), or null. */
export function reviewDue(
  now: Date,
  tz: string | null | undefined,
): { today: number; weekKey: string } | null {
  const clock = localClock(now, tz);
  if (clock.weekday !== 0 || clock.hour < SEND_HOUR) return null;
  return {
    today: clock.index,
    weekKey: isoOfIndex(reviewWeekStart(clock.index)),
  };
}

/** Emails each opted-in user their weekly review once per week; on by default only in production. */
@Injectable()
export class WeeklyReviewScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WeeklyReviewScheduler.name);
  private timer?: NodeJS.Timeout;
  private first?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly habits: HabitsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const flag = this.config.get<string>('WEEKLY_REVIEW_EMAIL')?.trim();
    const enabled = flag
      ? flag === 'on'
      : process.env.NODE_ENV === 'production';
    if (!enabled) return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
    this.first = setTimeout(() => void this.tick(), FIRST_TICK_MS);
    this.first.unref();
    this.logger.log('weekly review emails enabled');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.first) clearTimeout(this.first);
  }

  async tick(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      const users = await this.prisma.user.findMany({
        where: {
          weeklyReviewEmail: true,
          status: 'ACTIVE',
          habits: { some: { archivedAt: null } },
        },
        select: {
          id: true,
          name: true,
          email: true,
          timezone: true,
          weeklyReviewSentFor: true,
        },
      });
      const base = (
        this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5000'
      ).replace(/\/$/, '');

      for (const u of users) {
        const due = reviewDue(now, u.timezone);
        if (!due || u.weeklyReviewSentFor === due.weekKey) continue;
        const claimed = await this.prisma.user.updateMany({
          where: {
            id: u.id,
            OR: [
              { weeklyReviewSentFor: null },
              { weeklyReviewSentFor: { not: due.weekKey } },
            ],
          },
          data: { weeklyReviewSentFor: due.weekKey },
        });
        if (claimed.count === 0) continue;

        const review = await this.habits.weeklyReviewOn(u.id, due.today);
        if (review.due === 0) continue;
        await this.mail.send(u.email, 'weekly-review', {
          name: u.name,
          review,
          reviewUrl: `${base}/review`,
          settingsUrl: `${base}/profile`,
        });
        sent++;
      }
    } catch (err) {
      this.logger.error(
        `weekly review tick failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
    return sent;
  }
}
