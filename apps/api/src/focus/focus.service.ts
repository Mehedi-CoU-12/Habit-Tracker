import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CacheService } from '../redis/cache.service.js';
import { cacheKeys, TTL } from '../redis/cache-keys.js';
import { HabitsService } from '../habits/habits.service.js';
import { RecordSessionDto } from './dto/record-session.dto.js';

type DayTotals = { sessions: number; minutes: number };

export type FocusStats = {
  /** Anchored on the client's local day passed to GET /focus/stats. */
  today: DayTotals;
  /** Trailing 7 days, including today. */
  week: DayTotals;
  allTime: DayTotals & { days: number };
  /** Consecutive days with ≥1 session; an empty today doesn't break it. */
  streak: number;
  /** Highest-minute single day ever. */
  best: DayTotals;
  /** Trailing 14 days, oldest first — for the dedication chart. */
  days: ({ date: string } & DayTotals)[];
  /** Minutes grouped by habit, largest first. Null habitId = habit deleted. */
  byHabit: ({
    habitId: string | null;
    name: string;
    icon: string | null;
  } & DayTotals)[];
};

const dayKey = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

@Injectable()
export class FocusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly habits: HabitsService,
  ) {}

  /**
   * Idempotent by client-generated id (same contract as habit create): the
   * mobile outbox may replay a session after a crash, and a replay must not
   * double-count dedication.
   *
   * This early return is also what makes auto-log safe. `PUT /habits/logs/
   * amount` is absolute by design so replays converge, but "a 25-minute
   * session adds 25 minutes" is relative — composing the two naively double-
   * counts on every replay. Putting the increment *after* this guard, inside
   * the same transaction as the session row, means a replayed session
   * increments exactly once with no new idempotency machinery.
   */
  async recordSession(userId: string, dto: RecordSessionDto) {
    if (dto.id) {
      const existing = await this.prisma.focusSession.findUnique({
        where: { id: dto.id },
      });
      if (existing) {
        if (existing.userId !== userId) throw new ForbiddenException();
        return existing;
      }
    }

    // A habit deleted before an offline replay lands is history, not an
    // error — record the session unlinked so the dedication still counts.
    let habit: { id: string; target: number | null } | null = null;
    if (dto.habitId) {
      const found = await this.prisma.habit.findUnique({
        where: { id: dto.habitId },
        select: {
          id: true,
          userId: true,
          target: true,
          fillFromFocus: true,
        },
      });
      if (found) {
        if (found.userId !== userId) throw new ForbiddenException();
        // A null target here means "link the session, log nothing": either the
        // habit is opted out, or it is binary and has no amount to add minutes
        // to. Both keep the old client-driven behaviour.
        habit = {
          id: found.id,
          target: found.fillFromFocus ? found.target : null,
        };
      }
    }

    const { session, logged } = await this.prisma.transaction(async (tx) => {
      const session = await tx.focusSession.create({
        data: {
          ...(dto.id ? { id: dto.id } : {}),
          userId,
          habitId: habit?.id ?? null,
          minutes: dto.minutes,
          year: dto.year,
          month: dto.month,
          day: dto.day,
        },
      });

      if (!habit || habit.target === null) return { session, logged: false };

      // Clamped at the target: 50 minutes against a 30-minute target logs 30.
      // Letting it overflow renders as a broken progress bar in three places.
      const where = {
        habitId_year_month_day: {
          habitId: habit.id,
          year: dto.year,
          month: dto.month,
          day: dto.day,
        },
      };
      const current = await tx.habitLog.findUnique({ where });
      const amount = Math.min(
        habit.target,
        (current?.amount ?? 0) + dto.minutes,
      );
      await tx.habitLog.upsert({
        where,
        create: {
          habitId: habit.id,
          userId,
          year: dto.year,
          month: dto.month,
          day: dto.day,
          amount,
        },
        update: { amount },
      });
      return { session, logged: true };
    });

    await this.cache.bumpVersion(cacheKeys.focusVersion(userId));
    // The habits cache is stale too now — forgetting this is the bug where
    // the ring doesn't move until you pull to refresh.
    if (logged) await this.habits.invalidateHabits(userId);
    return session;
  }

  // Cached per (user, client-local day) under the user's focus version — any
  // recorded session bumps the version. The anchor day comes from the client
  // so "today"/"this week" follow the user's calendar, not the server's.
  getStats(
    userId: string,
    year: number,
    month: number,
    day: number,
  ): Promise<FocusStats> {
    return this.cache.getOrSetVersioned(
      cacheKeys.focusVersion(userId),
      cacheKeys.focusStatsDay(year, month, day),
      TTL.focusStats,
      () => this.computeStats(userId, year, month, day),
    );
  }

  private async computeStats(
    userId: string,
    year: number,
    month: number,
    day: number,
  ): Promise<FocusStats> {
    const [perDay, perHabit] = await Promise.all([
      this.prisma.focusSession.groupBy({
        by: ['year', 'month', 'day'],
        where: { userId },
        _sum: { minutes: true },
        _count: { _all: true },
      }),
      this.prisma.focusSession.groupBy({
        by: ['habitId'],
        where: { userId },
        _sum: { minutes: true },
        _count: { _all: true },
      }),
    ]);

    const byDay = new Map<string, DayTotals>();
    const allTime = { sessions: 0, minutes: 0, days: perDay.length };
    const best = { sessions: 0, minutes: 0 };
    for (const row of perDay) {
      const totals = {
        sessions: row._count._all,
        minutes: row._sum.minutes ?? 0,
      };
      byDay.set(dayKey(row.year, row.month, row.day), totals);
      allTime.sessions += totals.sessions;
      allTime.minutes += totals.minutes;
      if (totals.minutes > best.minutes) Object.assign(best, totals);
    }

    // Walk the calendar backwards from the client's today in UTC — the y/m/d
    // triplets are already client-local, UTC just does the date arithmetic.
    const anchor = Date.UTC(year, month - 1, day);
    const dayAt = (offset: number): string => {
      const d = new Date(anchor - offset * 86_400_000);
      return dayKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    };
    const totalsAt = (offset: number): DayTotals =>
      byDay.get(dayAt(offset)) ?? { sessions: 0, minutes: 0 };

    const days: FocusStats['days'] = [];
    for (let i = 13; i >= 0; i--) {
      days.push({ date: dayAt(i), ...totalsAt(i) });
    }
    const week = days.slice(-7).reduce(
      (acc, d) => ({
        sessions: acc.sessions + d.sessions,
        minutes: acc.minutes + d.minutes,
      }),
      { sessions: 0, minutes: 0 },
    );

    let streak = 0;
    const start = byDay.has(dayAt(0)) ? 0 : 1;
    while (byDay.has(dayAt(start + streak))) streak++;

    const habitIds = perHabit
      .map((r) => r.habitId)
      .filter((id): id is string => id !== null);
    const habits = habitIds.length
      ? await this.prisma.habit.findMany({
          where: { id: { in: habitIds } },
          select: { id: true, name: true, icon: true },
        })
      : [];
    const habitById = new Map(habits.map((h) => [h.id, h]));
    const byHabit = perHabit
      .map((r) => {
        const habit = r.habitId ? habitById.get(r.habitId) : undefined;
        return {
          habitId: r.habitId,
          name: habit?.name ?? 'Past habits',
          icon: habit?.icon ?? null,
          sessions: r._count._all,
          minutes: r._sum.minutes ?? 0,
        };
      })
      .sort((a, b) => b.minutes - a.minutes);

    return {
      today: totalsAt(0),
      week,
      allTime,
      streak,
      best,
      days,
      byHabit,
    };
  }
}
