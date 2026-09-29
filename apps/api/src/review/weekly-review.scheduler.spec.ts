import type { ConfigService } from '@nestjs/config';
import type { HabitsService } from '../habits/habits.service.js';
import type { WeeklyReview } from '../habits/progress.js';
import type { MailService } from '../mail/mail.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { reviewDue, WeeklyReviewScheduler } from './weekly-review.scheduler.js';

// Sunday 2026-09-13, 19:00 UTC.
const SUNDAY_EVENING = new Date(Date.UTC(2026, 8, 13, 19));

describe('reviewDue', () => {
  it('fires on a local Sunday evening, keyed by that week’s Monday', () => {
    expect(reviewDue(SUNDAY_EVENING, 'UTC')?.weekKey).toBe('2026-09-07');
  });

  it('waits for the evening and ignores other days', () => {
    expect(reviewDue(new Date(Date.UTC(2026, 8, 13, 12)), 'UTC')).toBeNull();
    // Already Monday 01:00 in Dhaka.
    expect(reviewDue(SUNDAY_EVENING, 'Asia/Dhaka')).toBeNull();
  });
});

describe('WeeklyReviewScheduler.tick', () => {
  const review = { due: 7, done: 5, habits: [] } as unknown as WeeklyReview;

  function setup(sentFor: string | null, claimCount = 1) {
    const sends: string[] = [];
    const prisma = {
      user: {
        findMany: () =>
          Promise.resolve([
            {
              id: 'u1',
              name: 'Ada',
              email: 'ada@test',
              timezone: 'UTC',
              weeklyReviewSentFor: sentFor,
            },
          ]),
        updateMany: () => Promise.resolve({ count: claimCount }),
      },
    } as unknown as PrismaService;
    const habits = {
      weeklyReviewOn: () => Promise.resolve(review),
    } as unknown as HabitsService;
    const mail = {
      send: (to: string) => {
        sends.push(to);
        return Promise.resolve();
      },
    } as unknown as MailService;
    const config = { get: () => undefined } as unknown as ConfigService;
    return {
      scheduler: new WeeklyReviewScheduler(prisma, habits, mail, config),
      sends,
    };
  }

  it('sends once when the week is unclaimed', async () => {
    const { scheduler, sends } = setup(null);
    expect(await scheduler.tick(SUNDAY_EVENING)).toBe(1);
    expect(sends).toEqual(['ada@test']);
  });

  it('skips a week already sent', async () => {
    const { scheduler, sends } = setup('2026-09-07');
    await scheduler.tick(SUNDAY_EVENING);
    expect(sends).toEqual([]);
  });

  it('skips when another instance won the claim', async () => {
    const { scheduler, sends } = setup(null, 0);
    await scheduler.tick(SUNDAY_EVENING);
    expect(sends).toEqual([]);
  });
});
