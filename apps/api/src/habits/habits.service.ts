import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateHabitDto } from './dto/create-habit.dto.js';
import { UpdateHabitDto } from './dto/update-habit.dto.js';
import { ToggleLogDto } from './dto/toggle-log.dto.js';
import { SetLogDto } from './dto/set-log.dto.js';

type TemplateHabit = {
  name: string;
  goal: number;
  icon: string;
  tod: string;
  verb?: string;
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
    },
    {
      name: 'Exercise',
      goal: 20,
      icon: 'dumbbell',
      tod: 'morning',
      verb: '30 min',
    },
    {
      name: 'Meditate',
      goal: 20,
      icon: 'moon',
      tod: 'morning',
      verb: '10 min',
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
    },
    {
      name: 'Walk 10k steps',
      goal: 25,
      icon: 'sprout',
      tod: 'afternoon',
      verb: '10k steps',
    },
    { name: 'Stretch', goal: 20, icon: 'leaf', tod: 'evening', verb: '10 min' },
    {
      name: 'Sleep 8 hours',
      goal: 28,
      icon: 'moonStars',
      tod: 'evening',
      verb: '8 hrs',
    },
  ],
  study: [
    {
      name: 'Study 1 hour',
      goal: 22,
      icon: 'book',
      tod: 'afternoon',
      verb: '1 hour',
    },
    {
      name: 'Read 20 pages',
      goal: 20,
      icon: 'book',
      tod: 'evening',
      verb: '20 pages',
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
    },
    {
      name: 'Sleep 8 hours',
      goal: 28,
      icon: 'moonStars',
      tod: 'evening',
      verb: '8 hrs',
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
    },
    {
      name: 'Gratitude journal',
      goal: 20,
      icon: 'pen',
      tod: 'evening',
      verb: '3 things',
    },
    { name: 'Digital detox 1 hour', goal: 22, icon: 'cloud', tod: 'evening' },
    {
      name: 'Deep breathing',
      goal: 20,
      icon: 'sprout',
      tod: 'anytime',
      verb: '5 min',
    },
  ],
};

/** IDs of the built-in templates, used for request validation. */
export const TEMPLATE_IDS = Object.keys(TEMPLATES);

@Injectable()
export class HabitsService {
  constructor(private readonly prisma: PrismaService) {}

  getHabitsWithLogs(userId: string, year: number, month: number) {
    return this.prisma.habit.findMany({
      where: { userId },
      include: {
        logs: { where: { year, month } },
      },
      orderBy: { createdAt: 'asc' },
    });
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
    return this.prisma.habit.create({
      data: {
        ...(dto.id ? { id: dto.id } : {}),
        userId,
        name: dto.name,
        goal: dto.goal,
        ...(dto.icon ? { icon: dto.icon } : {}),
        ...(dto.tod ? { tod: dto.tod } : {}),
        ...(dto.verb ? { verb: dto.verb } : {}),
      },
    });
  }

  async updateHabit(userId: string, habitId: string, dto: UpdateHabitDto) {
    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
    });
    if (!habit) throw new NotFoundException('Habit not found');
    if (habit.userId !== userId) throw new ForbiddenException();
    return this.prisma.habit.update({
      where: { id: habitId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.goal !== undefined ? { goal: dto.goal } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.tod !== undefined ? { tod: dto.tod } : {}),
        ...(dto.verb !== undefined ? { verb: dto.verb } : {}),
      },
    });
  }

  async deleteHabit(userId: string, habitId: string) {
    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
    });
    if (!habit) throw new NotFoundException('Habit not found');
    if (habit.userId !== userId) throw new ForbiddenException();
    return this.prisma.habit.delete({ where: { id: habitId } });
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
      })),
    });

    return { created: habits.length };
  }

  async toggleLog(userId: string, dto: ToggleLogDto) {
    const { habitId, year, month, day } = dto;

    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
    });
    if (!habit) throw new NotFoundException('Habit not found');
    if (habit.userId !== userId) throw new ForbiddenException();

    const existing = await this.prisma.habitLog.findUnique({
      where: { habitId_year_month_day: { habitId, year, month, day } },
    });

    if (existing) {
      await this.prisma.habitLog.delete({ where: { id: existing.id } });
      return { completed: false };
    }

    await this.prisma.habitLog.create({
      data: { habitId, userId, year, month, day },
    });
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
      await this.prisma.habitLog.upsert({
        where,
        create: { habitId, userId, year, month, day },
        update: {},
      });
    } else {
      // deleteMany (not delete) so clearing an already-absent cell is a no-op.
      await this.prisma.habitLog.deleteMany({
        where: { habitId, year, month, day },
      });
    }
    return { completed };
  }
}
