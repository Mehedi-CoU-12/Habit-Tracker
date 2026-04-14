import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateHabitDto } from './dto/create-habit.dto.js';
import { ToggleLogDto } from './dto/toggle-log.dto.js';

const TEMPLATES: Record<string, Array<{ name: string; goal: number }>> = {
  'morning-routine': [
    { name: 'Wake up early', goal: 25 },
    { name: 'Drink water', goal: 30 },
    { name: 'Exercise', goal: 20 },
    { name: 'Meditate', goal: 20 },
    { name: 'Journal', goal: 15 },
  ],
  fitness: [
    { name: 'Workout', goal: 20 },
    { name: 'Walk 10k steps', goal: 25 },
    { name: 'Stretch', goal: 20 },
    { name: 'Sleep 8 hours', goal: 28 },
  ],
  study: [
    { name: 'Study 1 hour', goal: 22 },
    { name: 'Read 20 pages', goal: 20 },
    { name: 'No social media', goal: 20 },
    { name: 'Review notes', goal: 18 },
  ],
  health: [
    { name: 'Drink 8 glasses of water', goal: 28 },
    { name: 'Sleep 8 hours', goal: 28 },
    { name: 'Take vitamins', goal: 28 },
    { name: 'No junk food', goal: 22 },
  ],
  mindfulness: [
    { name: 'Meditate', goal: 20 },
    { name: 'Gratitude journal', goal: 20 },
    { name: 'Digital detox 1 hour', goal: 22 },
    { name: 'Deep breathing', goal: 20 },
  ],
};

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

  createHabit(userId: string, dto: CreateHabitDto) {
    return this.prisma.habit.create({
      data: { userId, name: dto.name, goal: dto.goal },
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
      data: habits.map((h) => ({ userId, name: h.name, goal: h.goal })),
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
}
