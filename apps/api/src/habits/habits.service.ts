import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CacheService } from '../redis/cache.service.js';
import { cacheKeys, TTL } from '../redis/cache-keys.js';
import { CreateHabitDto } from './dto/create-habit.dto.js';
import { UpdateHabitDto } from './dto/update-habit.dto.js';
import { ToggleLogDto } from './dto/toggle-log.dto.js';
import { SetLogDto } from './dto/set-log.dto.js';
import { SetLogAmountDto } from './dto/set-log-amount.dto.js';
import { SetSkipDto } from './dto/set-skip.dto.js';

type TemplateHabit = {
  name: string;
  goal: number;
  icon: string;
  tod: string;
  verb?: string;
  /** Daily target; absent leaves the habit binary. */
  target?: number;
  unit?: string;
  step?: number;
};

export const TEMPLATES: Record<string, TemplateHabit[]> = {
  'morning-routine': [
    {
      name: 'Wake up early',
      goal: 25,
      icon: 'sun',
      tod: 'morning',
      verb: '6:00am',
    },
    {
      name: 'Drink water',
      goal: 30,
      icon: 'droplet',
      tod: 'morning',
      verb: '8 cups',
      target: 8,
      unit: 'cups',
    },
    {
      name: 'Exercise',
      goal: 20,
      icon: 'dumbbell',
      tod: 'morning',
      verb: '30 min',
      target: 30,
      unit: 'min',
      step: 5,
    },
    {
      name: 'Meditate',
      goal: 20,
      icon: 'moon',
      tod: 'morning',
      verb: '10 min',
      target: 10,
      unit: 'min',
      step: 5,
    },
    {
      name: 'Journal',
      goal: 15,
      icon: 'pen',
      tod: 'morning',
      verb: 'morning pages',
    },
  ],
  fitness: [
    {
      name: 'Workout',
      goal: 20,
      icon: 'dumbbell',
      tod: 'afternoon',
      verb: '30 min',
      target: 30,
      unit: 'min',
      step: 5,
    },
    {
      name: 'Walk 10k steps',
      goal: 25,
      icon: 'sprout',
      tod: 'afternoon',
      verb: '10k steps',
      target: 10000,
      unit: 'steps',
      step: 500,
    },
    { name: 'Stretch', goal: 20, icon: 'leaf', tod: 'evening', verb: '10 min' },
    {
      name: 'Sleep 8 hours',
      goal: 28,
      icon: 'moonStars',
      tod: 'evening',
      verb: '8 hrs',
      target: 8,
      unit: 'hrs',
    },
  ],
  study: [
    {
      name: 'Study 1 hour',
      goal: 22,
      icon: 'book',
      tod: 'afternoon',
      verb: '1 hour',
      target: 60,
      unit: 'min',
      step: 5,
    },
    {
      name: 'Read 20 pages',
      goal: 20,
      icon: 'book',
      tod: 'evening',
      verb: '20 pages',
      target: 20,
      unit: 'pages',
      step: 5,
    },
    { name: 'No social media', goal: 20, icon: 'cloud', tod: 'anytime' },
    { name: 'Review notes', goal: 18, icon: 'pen', tod: 'evening' },
  ],
  health: [
    {
      name: 'Drink 8 glasses of water',
      goal: 28,
      icon: 'droplet',
      tod: 'morning',
      verb: '8 cups',
      target: 8,
      unit: 'cups',
    },
    {
      name: 'Sleep 8 hours',
      goal: 28,
      icon: 'moonStars',
      tod: 'evening',
      verb: '8 hrs',
      target: 8,
      unit: 'hrs',
    },
    { name: 'Take vitamins', goal: 28, icon: 'sun', tod: 'morning' },
    { name: 'No junk food', goal: 22, icon: 'leaf', tod: 'anytime' },
  ],
  mindfulness: [
    {
      name: 'Meditate',
      goal: 20,
      icon: 'moon',
      tod: 'morning',
      verb: '10 min',
      target: 10,
      unit: 'min',
      step: 5,
    },
    {
      name: 'Gratitude journal',
      goal: 20,
      icon: 'pen',
      tod: 'evening',
      verb: '3 things',
      target: 3,
      unit: 'things',
    },
    { name: 'Digital detox 1 hour', goal: 22, icon: 'cloud', tod: 'evening' },
    {
      name: 'Deep breathing',
      goal: 20,
      icon: 'sprout',
      tod: 'anytime',
      verb: '5 min',
      target: 5,
      unit: 'min',
    },
  ],
};

/** IDs of the built-in templates, used for request validation. */
export const TEMPLATE_IDS = Object.keys(TEMPLATES);

/**
 * Skips one habit may spend per calendar month.
 *
 * Per-habit because habits differ in difficulty; monthly because the clients'
 * month-scoped stats already break there, so the allowance and the maths share
 * a natural boundary. A shared per-account pool would mean a hard habit's skip
 * is stolen from an easy one, and users would have to budget.
 */
export const SKIPS_PER_MONTH = 1;

/** Weekday (0 = Sunday) of a y/m/d triplet, without building a local Date. */
function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

@Injectable()
export class HabitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // Cached per (user, month) under the user's habits version — any habit or
  // log mutation bumps the version (see invalidateHabits), which invalidates
  // every cached month at once. Serves the user's own GET /habits and the
  // admin's GET /admin/users/:id/habits alike.
  getHabitsWithLogs(userId: string, year: number, month: number) {
    return this.cache.getOrSetVersioned(
      cacheKeys.habitsVersion(userId),
      cacheKeys.habitsMonth(year, month),
      TTL.habits,
      () =>
        this.prisma.habit.findMany({
          where: { userId },
          include: {
            logs: { where: { year, month } },
            // The clients cannot compute a forgiven streak without these, and
            // they are month-scoped exactly like the logs.
            skips: { where: { year, month } },
          },
          orderBy: { createdAt: 'asc' },
        }),
    );
  }

  /** Drop every cached month of this user's habit data. */
  invalidateHabits(userId: string) {
    return this.cache.bumpVersion(cacheKeys.habitsVersion(userId));
  }

  async createHabit(userId: string, dto: CreateHabitDto) {
    // A client-supplied id makes create idempotent: the mobile app generates the
    // id up front (so an offline-created habit has a stable id its queued logs
    // can reference) and the sync worker may resend the same create on retry.
    // Replaying it must not create a duplicate.
    if (dto.id) {
      const existing = await this.prisma.habit.findUnique({
        where: { id: dto.id },
      });
      if (existing) {
        if (existing.userId !== userId) throw new ForbiddenException();
        return existing; // already created by an earlier (successful) attempt
      }
    }
    const habit = await this.prisma.habit.create({
      data: {
        ...(dto.id ? { id: dto.id } : {}),
        userId,
        name: dto.name,
        goal: dto.goal,
        ...(dto.icon ? { icon: dto.icon } : {}),
        ...(dto.tod ? { tod: dto.tod } : {}),
        ...(dto.verb ? { verb: dto.verb } : {}),
        // unit/step are meaningless without a target, so they ride along only
        // when one is given.
        ...(dto.target
          ? {
              target: dto.target,
              ...(dto.unit ? { unit: dto.unit } : {}),
              ...(dto.step ? { step: dto.step } : {}),
              ...(dto.fillFromFocus !== undefined
                ? { fillFromFocus: dto.fillFromFocus }
                : {}),
            }
          : {}),
        ...(dto.daysOfWeek ? { daysOfWeek: dto.daysOfWeek } : {}),
      },
    });
    await this.invalidateHabits(userId);
    return habit;
  }

  async updateHabit(userId: string, habitId: string, dto: UpdateHabitDto) {
    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
    });
    if (!habit) throw new NotFoundException('Habit not found');
    if (habit.userId !== userId) throw new ForbiddenException();
    const updated = await this.prisma.habit.update({
      where: { id: habitId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.goal !== undefined ? { goal: dto.goal } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.tod !== undefined ? { tod: dto.tod } : {}),
        ...(dto.verb !== undefined ? { verb: dto.verb } : {}),
        // Clearing the target reverts the habit to binary, so unit and step go
        // with it rather than lingering as orphans.
        ...(dto.target === null
          ? // Auto-fill is meaningless without a target, so it goes with it
            // rather than lingering as a flag nothing can act on.
            { target: null, unit: null, step: 1, fillFromFocus: false }
          : {
              ...(dto.target !== undefined ? { target: dto.target } : {}),
              ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
              ...(dto.step !== undefined ? { step: dto.step } : {}),
              ...(dto.fillFromFocus !== undefined
                ? { fillFromFocus: dto.fillFromFocus }
                : {}),
            }),
        ...(dto.daysOfWeek !== undefined ? { daysOfWeek: dto.daysOfWeek } : {}),
        // The server owns the timestamp; the client only says which way.
        // Re-archiving an already-archived habit keeps the original date, so
        // a replayed offline op can't quietly move it.
        ...(dto.archived !== undefined
          ? {
              archivedAt: dto.archived
                ? (habit.archivedAt ?? new Date())
                : null,
            }
          : {}),
      },
    });
    await this.invalidateHabits(userId);
    return updated;
  }

  async deleteHabit(userId: string, habitId: string) {
    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
    });
    if (!habit) throw new NotFoundException('Habit not found');
    if (habit.userId !== userId) throw new ForbiddenException();
    const deleted = await this.prisma.habit.delete({ where: { id: habitId } });
    await this.invalidateHabits(userId);
    // Deleting the habit just unlinked its focus sessions (SetNull) — drop the
    // cached dedication stats so byHabit stops naming the dead habit.
    await this.cache.bumpVersion(cacheKeys.focusVersion(userId));
    return deleted;
  }

  async applyTemplate(userId: string, templateId: string) {
    const habits = TEMPLATES[templateId];
    if (!habits) throw new NotFoundException('Template not found');

    await this.prisma.habit.createMany({
      data: habits.map((h) => ({
        userId,
        name: h.name,
        goal: h.goal,
        icon: h.icon,
        tod: h.tod,
        ...(h.verb ? { verb: h.verb } : {}),
        ...(h.target
          ? {
              target: h.target,
              ...(h.unit ? { unit: h.unit } : {}),
              ...(h.step ? { step: h.step } : {}),
            }
          : {}),
      })),
    });
    await this.invalidateHabits(userId);

    return { created: habits.length };
  }

  async toggleLog(userId: string, dto: ToggleLogDto) {
    const { habitId, year, month, day } = dto;

    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
    });
    if (!habit) throw new NotFoundException('Habit not found');
    if (habit.userId !== userId) throw new ForbiddenException();

    const where = { habitId_year_month_day: { habitId, year, month, day } };
    const target = habit.target ?? 1;
    const existing = await this.prisma.habitLog.findUnique({ where });

    // Only a day that already counts as complete flips back off. A partially
    // filled one is not complete yet, so toggling fills it to the target
    // instead of discarding the progress already logged against it.
    if (existing && existing.amount >= target) {
      await this.prisma.habitLog.delete({ where: { id: existing.id } });
      await this.invalidateHabits(userId);
      return { completed: false };
    }

    await this.prisma.habitLog.upsert({
      where,
      create: { habitId, userId, year, month, day, amount: target },
      update: { amount: target },
    });
    await this.invalidateHabits(userId);
    return { completed: true };
  }

  async setLog(userId: string, dto: SetLogDto) {
    const { habitId, year, month, day, completed } = dto;

    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
    });
    if (!habit) throw new NotFoundException('Habit not found');
    if (habit.userId !== userId) throw new ForbiddenException();

    const where = { habitId_year_month_day: { habitId, year, month, day } };
    if (completed) {
      // upsert (not create) so a replayed "done" is a no-op, never a duplicate.
      const amount = habit.target ?? 1;
      await this.prisma.habitLog.upsert({
        where,
        create: { habitId, userId, year, month, day, amount },
        update: { amount },
      });
    } else {
      // deleteMany (not delete) so clearing an already-absent cell is a no-op.
      await this.prisma.habitLog.deleteMany({
        where: { habitId, year, month, day },
      });
    }
    await this.invalidateHabits(userId);
    return { completed };
  }

  /**
   * Spend or release one skip on a (habit, date) cell. Absolute and idempotent
   * like setLog, so a replayed offline op converges to one row rather than
   * toggling the skip off again.
   *
   * The monthly allowance is enforced here rather than in the UI: a client-side
   * check is a suggestion.
   */
  async setSkip(userId: string, dto: SetSkipDto) {
    const { habitId, year, month, day, used } = dto;

    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
    });
    if (!habit) throw new NotFoundException('Habit not found');
    if (habit.userId !== userId) throw new ForbiddenException();

    const where = { habitId_year_month_day: { habitId, year, month, day } };

    if (!used) {
      // deleteMany so releasing an unspent day is a no-op, never a 404.
      await this.prisma.habitSkip.deleteMany({
        where: { habitId, year, month, day },
      });
      await this.invalidateHabits(userId);
      return {
        used: false,
        remaining: await this.skipsLeft(habitId, year, month),
      };
    }

    // A rest day already behaves like a skip, so there is nothing to buy.
    // Refusing rather than silently accepting keeps the allowance honest.
    if (
      habit.daysOfWeek.length > 0 &&
      !habit.daysOfWeek.includes(weekdayOf(year, month, day))
    ) {
      throw new BadRequestException(
        'This habit was not due that day — a skip would change nothing',
      );
    }

    const existing = await this.prisma.habitSkip.findUnique({ where });
    if (existing) {
      // Already spent on this exact day: a replay, not a second skip.
      return {
        used: true,
        remaining: await this.skipsLeft(habitId, year, month),
      };
    }

    const spent = await this.prisma.habitSkip.count({
      where: { habitId, year, month },
    });
    if (spent >= SKIPS_PER_MONTH) {
      throw new BadRequestException(
        `You have used your skip for this habit in ${month}/${year}`,
      );
    }

    await this.prisma.habitSkip.create({
      data: { habitId, userId, year, month, day },
    });
    await this.invalidateHabits(userId);
    return {
      used: true,
      remaining: await this.skipsLeft(habitId, year, month),
    };
  }

  /** Skips this habit has left in one calendar month, never below zero. */
  private async skipsLeft(habitId: string, year: number, month: number) {
    const spent = await this.prisma.habitSkip.count({
      where: { habitId, year, month },
    });
    return Math.max(0, SKIPS_PER_MONTH - spent);
  }

  /** Absolute amount write. Zero clears the cell; completion is derived. */
  async setLogAmount(userId: string, dto: SetLogAmountDto) {
    const { habitId, year, month, day, amount } = dto;

    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
    });
    if (!habit) throw new NotFoundException('Habit not found');
    if (habit.userId !== userId) throw new ForbiddenException();

    if (amount <= 0) {
      // deleteMany so clearing an already-absent cell is a no-op.
      await this.prisma.habitLog.deleteMany({
        where: { habitId, year, month, day },
      });
    } else {
      await this.prisma.habitLog.upsert({
        where: { habitId_year_month_day: { habitId, year, month, day } },
        create: { habitId, userId, year, month, day, amount },
        update: { amount },
      });
    }
    await this.invalidateHabits(userId);
    return { amount, completed: amount >= (habit.target ?? 1) };
  }
}
