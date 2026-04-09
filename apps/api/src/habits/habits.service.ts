import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateHabitDto } from './dto/create-habit.dto.js';
import { ToggleLogDto } from './dto/toggle-log.dto.js';

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
    const habit = await this.prisma.habit.findUnique({ where: { id: habitId } });
    if (!habit) throw new NotFoundException('Habit not found');
    if (habit.userId !== userId) throw new ForbiddenException();
    return this.prisma.habit.delete({ where: { id: habitId } });
  }

  async toggleLog(userId: string, dto: ToggleLogDto) {
    const { habitId, year, month, day } = dto;

    const habit = await this.prisma.habit.findUnique({ where: { id: habitId } });
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
