import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, Prisma, Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HabitsService } from '../habits/habits.service.js';
import { pageParams, type Paginated } from '../common/pagination.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';

const USER_ROW_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  role: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly habitsService: HabitsService,
  ) {}

  async getStats() {
    const now = new Date();
    const today = {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
    // Midnight six days ago → a 7-bucket window that includes today.
    const windowStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6,
    );

    const [byStatus, totalHabits, logsToday, activeToday, recentSignups] =
      await Promise.all([
        this.prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.habit.count(),
        this.prisma.habitLog.count({ where: today }),
        this.prisma.habitLog.findMany({
          where: today,
          distinct: ['userId'],
          select: { userId: true },
        }),
        this.prisma.user.findMany({
          where: { createdAt: { gte: windowStart } },
          select: { createdAt: true },
        }),
      ]);

    const usersByStatus: Record<AccountStatus, number> = {
      PENDING: 0,
      ACTIVE: 0,
      SUSPENDED: 0,
    };
    for (const group of byStatus) {
      usersByStatus[group.status] = group._count._all;
    }

    // Bucket signups per calendar day so the chart always gets 7 points,
    // zeros included.
    const signupsLast7Days: { date: string; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(
        windowStart.getFullYear(),
        windowStart.getMonth(),
        windowStart.getDate() + i,
      );
      signupsLast7Days.push({ date: toDateKey(d), count: 0 });
    }
    const bucketByDate = new Map(signupsLast7Days.map((b) => [b.date, b]));
    for (const { createdAt } of recentSignups) {
      bucketByDate.get(toDateKey(createdAt))!.count += 1;
    }

    return {
      totalUsers: Object.values(usersByStatus).reduce((a, b) => a + b, 0),
      usersByStatus,
      totalHabits,
      logsToday,
      activeUsersToday: activeToday.length,
      signupsLast7Days,
    };
  }

  async listUsers(query: ListUsersDto): Promise<Paginated<unknown>> {
    const { skip, take, page, pageSize } = pageParams(
      query.page,
      query.pageSize,
    );

    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          ...USER_ROW_SELECT,
          _count: { select: { habits: true } },
        },
      }),
    ]);

    // Per-row aggregates for just this page — two grouped queries instead of
    // N+1 lookups.
    const ids = users.map((u) => u.id);
    const [lastLogs, paidSums] = ids.length
      ? await Promise.all([
          this.prisma.habitLog.groupBy({
            by: ['userId'],
            where: { userId: { in: ids } },
            _max: { createdAt: true },
          }),
          this.prisma.payment.groupBy({
            by: ['userId'],
            where: { userId: { in: ids } },
            _sum: { amount: true },
          }),
        ])
      : [[], []];

    const lastActiveByUser = new Map(
      lastLogs.map((g) => [g.userId, g._max.createdAt]),
    );
    const totalPaidByUser = new Map(
      paidSums.map((g) => [g.userId, g._sum.amount ?? 0]),
    );

    const items = users.map(({ _count, ...user }) => ({
      ...user,
      habitCount: _count.habits,
      lastActiveAt: lastActiveByUser.get(user.id) ?? null,
      totalPaid: totalPaidByUser.get(user.id) ?? 0,
    }));

    return { items, total, page, pageSize };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_ROW_SELECT,
        statusChangedAt: true,
        statusChangedBy: true,
        statusNote: true,
        _count: { select: { habits: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const { _count, ...rest } = user;
    return {
      ...rest,
      habitCount: _count.habits,
      totalPaid: user.payments.reduce((sum, p) => sum + p.amount, 0),
    };
  }

  // Same payload shape as the user's own GET /habits (D7): the admin UI
  // reuses the dashboard's deriveStats + chart components unchanged.
  async getUserHabits(id: string, year: number, month: number) {
    await this.ensureUserExists(id);
    return this.habitsService.getHabitsWithLogs(id, year, month);
  }

  async updateStatus(adminId: string, targetId: string, dto: UpdateStatusDto) {
    await this.ensureTargetIsModifiable(adminId, targetId);
    return this.prisma.user.update({
      where: { id: targetId },
      data: {
        status: dto.status,
        statusChangedAt: new Date(),
        statusChangedBy: adminId,
        statusNote: dto.note ?? null,
      },
      select: {
        ...USER_ROW_SELECT,
        statusChangedAt: true,
        statusNote: true,
      },
    });
  }

  async deleteUser(adminId: string, targetId: string) {
    await this.ensureTargetIsModifiable(adminId, targetId);
    // Habits, logs and payments cascade at the DB level.
    await this.prisma.user.delete({ where: { id: targetId } });
    return { id: targetId, deleted: true };
  }

  async recordPayment(
    adminId: string,
    targetId: string,
    dto: CreatePaymentDto,
  ) {
    await this.ensureUserExists(targetId);
    return this.prisma.payment.create({
      data: {
        userId: targetId,
        amount: dto.amount,
        ...(dto.note ? { note: dto.note } : {}),
        recordedById: adminId,
      },
    });
  }

  async listPayments(targetId: string) {
    await this.ensureUserExists(targetId);
    return this.prisma.payment.findMany({
      where: { userId: targetId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async ensureUserExists(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
  }

  /**
   * Safety rules for destructive actions (D9): admins can never change or
   * delete themselves (400) or another admin (403) — self-lockout is
   * prevented here, not by special-casing the guards.
   */
  private async ensureTargetIsModifiable(adminId: string, targetId: string) {
    if (targetId === adminId) {
      throw new BadRequestException('You cannot change your own account.');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { role: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === Role.ADMIN) {
      throw new ForbiddenException(
        'Admin accounts cannot be modified from the dashboard.',
      );
    }
  }
}

function toDateKey(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}
