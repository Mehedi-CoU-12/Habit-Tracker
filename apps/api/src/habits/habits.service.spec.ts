import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { HabitsService } from './habits.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CacheService } from '../redis/cache.service.js';

type HabitRow = { id: string; userId: string; target: number | null };
type LogRow = { id: string; amount: number };
type UpsertArg = { create: { amount: number }; update: { amount: number } };

/** A call-recording stub. Jest's own `jest.fn()` is unavailable under ESM. */
type Stub<A, R> = {
  (arg: A): Promise<R>;
  calls: A[];
  returns: (value: R) => void;
};

function stub<A, R = unknown>(value?: R): Stub<A, R> {
  let result = value as R;
  const f = (arg: A) => {
    f.calls.push(arg);
    return Promise.resolve(result);
  };
  f.calls = [] as A[];
  f.returns = (v: R) => {
    result = v;
  };
  return f as Stub<A, R>;
}

/** Minimal in-memory stand-ins for the two collaborators the service uses. */
function makeService(habit: HabitRow | null) {
  const habitLog = {
    findUnique: stub<unknown, LogRow | null>(null),
    create: stub<unknown>(),
    delete: stub<unknown>(),
    deleteMany: stub<unknown>(),
    upsert: stub<UpsertArg>(),
  };
  const prisma = {
    habit: { findUnique: stub<unknown, HabitRow | null>(habit) },
    habitLog,
  } as unknown as PrismaService;
  const cache = { bumpVersion: stub<unknown>() } as unknown as CacheService;
  return { service: new HabitsService(prisma, cache), habitLog, cache };
}

const cell = { habitId: 'h1', year: 2026, month: 9, day: 3 };

describe('setLogAmount', () => {
  it('upserts the amount and derives completion against the target', async () => {
    const { service, habitLog } = makeService({
      id: 'h1',
      userId: 'u1',
      target: 8,
    });

    await expect(
      service.setLogAmount('u1', { ...cell, amount: 3 }),
    ).resolves.toEqual({ amount: 3, completed: false });

    await expect(
      service.setLogAmount('u1', { ...cell, amount: 8 }),
    ).resolves.toEqual({ amount: 8, completed: true });

    // Over the target still reads as complete, never as an error.
    await expect(
      service.setLogAmount('u1', { ...cell, amount: 12 }),
    ).resolves.toEqual({ amount: 12, completed: true });

    expect(habitLog.upsert.calls).toHaveLength(3);
    expect(habitLog.deleteMany.calls).toHaveLength(0);
  });

  it('a binary habit completes at 1', async () => {
    const { service } = makeService({ id: 'h1', userId: 'u1', target: null });
    await expect(
      service.setLogAmount('u1', { ...cell, amount: 1 }),
    ).resolves.toEqual({ amount: 1, completed: true });
  });

  it('zero clears the cell instead of writing a row', async () => {
    const { service, habitLog } = makeService({
      id: 'h1',
      userId: 'u1',
      target: 8,
    });

    await expect(
      service.setLogAmount('u1', { ...cell, amount: 0 }),
    ).resolves.toEqual({ amount: 0, completed: false });

    expect(habitLog.deleteMany.calls[0]).toEqual({ where: { ...cell } });
    expect(habitLog.upsert.calls).toHaveLength(0);
  });

  it('is idempotent on replay — the same write converges', async () => {
    const { service, habitLog } = makeService({
      id: 'h1',
      userId: 'u1',
      target: 8,
    });

    const once = await service.setLogAmount('u1', { ...cell, amount: 5 });
    const twice = await service.setLogAmount('u1', { ...cell, amount: 5 });

    expect(twice).toEqual(once);
    // upsert, not create — a replay must never duplicate the row.
    expect(habitLog.create.calls).toHaveLength(0);
    for (const arg of habitLog.upsert.calls) {
      expect(arg.update).toEqual({ amount: 5 });
    }
  });

  it('rejects a habit that is missing or belongs to someone else', async () => {
    const missing = makeService(null);
    await expect(
      missing.service.setLogAmount('u1', { ...cell, amount: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const theirs = makeService({ id: 'h1', userId: 'someone-else', target: 8 });
    await expect(
      theirs.service.setLogAmount('u1', { ...cell, amount: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('the binary write paths on a quantified habit', () => {
  it('toggleLog fills a fresh day to the full target, not to 1', async () => {
    const { service, habitLog } = makeService({
      id: 'h1',
      userId: 'u1',
      target: 8,
    });

    await expect(service.toggleLog('u1', cell)).resolves.toEqual({
      completed: true,
    });
    const { create, update } = habitLog.upsert.calls[0];
    expect(create.amount).toBe(8);
    expect(update.amount).toBe(8);
  });

  it('toggleLog fills a partial day rather than discarding its progress', async () => {
    const { service, habitLog } = makeService({
      id: 'h1',
      userId: 'u1',
      target: 8,
    });
    habitLog.findUnique.returns({ id: 'l1', amount: 3 });

    await expect(service.toggleLog('u1', cell)).resolves.toEqual({
      completed: true,
    });
    expect(habitLog.delete.calls).toHaveLength(0);
    expect(habitLog.upsert.calls[0].update.amount).toBe(8);
  });

  it('toggleLog clears a day that is already complete', async () => {
    const { service, habitLog } = makeService({
      id: 'h1',
      userId: 'u1',
      target: 8,
    });
    habitLog.findUnique.returns({ id: 'l1', amount: 8 });

    await expect(service.toggleLog('u1', cell)).resolves.toEqual({
      completed: false,
    });
    expect(habitLog.delete.calls[0]).toEqual({ where: { id: 'l1' } });
    expect(habitLog.upsert.calls).toHaveLength(0);
  });

  it('setLog(completed) writes the full target on create and on replay', async () => {
    const { service, habitLog } = makeService({
      id: 'h1',
      userId: 'u1',
      target: 8,
    });

    await service.setLog('u1', { ...cell, completed: true });

    const { create, update } = habitLog.upsert.calls[0];
    expect(create.amount).toBe(8);
    // Without this the second tick of an already-partial day would leave it partial.
    expect(update.amount).toBe(8);
  });

  it('a binary habit is untouched — writes 1, and one tap still clears it', async () => {
    const fresh = makeService({ id: 'h1', userId: 'u1', target: null });
    await expect(fresh.service.toggleLog('u1', cell)).resolves.toEqual({
      completed: true,
    });
    expect(fresh.habitLog.upsert.calls[0].create.amount).toBe(1);

    const done = makeService({ id: 'h1', userId: 'u1', target: null });
    done.habitLog.findUnique.returns({ id: 'l1', amount: 1 });
    await expect(done.service.toggleLog('u1', cell)).resolves.toEqual({
      completed: false,
    });
    expect(done.habitLog.delete.calls[0]).toEqual({ where: { id: 'l1' } });
  });
});

// ── Streak insurance ────────────────────────────────────────────────────────

type SkipRow = { habitId: string; year: number; month: number; day: number };
type SkipHabit = HabitRow & { daysOfWeek: number[] };

/**
 * The service against an in-memory skip table, so allowance and idempotency
 * are exercised against real accumulated state rather than a fixed count.
 */
function makeSkipService(habit: SkipHabit | null) {
  const rows: SkipRow[] = [];
  const match = (w: { habitId: string; year: number; month: number }) =>
    rows.filter(
      (r) =>
        r.habitId === w.habitId && r.year === w.year && r.month === w.month,
    );

  const habitSkip = {
    findUnique: ({
      where,
    }: {
      where: { habitId_year_month_day: SkipRow };
    }) => {
      const k = where.habitId_year_month_day;
      return Promise.resolve(
        rows.find(
          (r) =>
            r.habitId === k.habitId &&
            r.year === k.year &&
            r.month === k.month &&
            r.day === k.day,
        ) ?? null,
      );
    },
    count: ({ where }: { where: SkipRow }) =>
      Promise.resolve(match(where).length),
    create: ({ data }: { data: SkipRow }) => {
      rows.push(data);
      return Promise.resolve(data);
    },
    deleteMany: ({ where }: { where: SkipRow }) => {
      const i = rows.findIndex(
        (r) =>
          r.habitId === where.habitId &&
          r.year === where.year &&
          r.month === where.month &&
          r.day === where.day,
      );
      if (i >= 0) rows.splice(i, 1);
      return Promise.resolve({ count: i >= 0 ? 1 : 0 });
    },
  };

  const prisma = {
    habit: { findUnique: stub<unknown, SkipHabit | null>(habit) },
    habitSkip,
  } as unknown as PrismaService;
  const cache = { bumpVersion: stub<unknown>() } as unknown as CacheService;
  return { service: new HabitsService(prisma, cache), rows };
}

const daily: SkipHabit = {
  id: 'h1',
  userId: 'u1',
  target: null,
  daysOfWeek: [],
};

const skipAt = (day: number, month = 9) => ({
  habitId: 'h1',
  year: 2026,
  month,
  day,
  used: true,
});

describe('setSkip', () => {
  it('spends one skip and reports the allowance left', async () => {
    const { service, rows } = makeSkipService(daily);

    await expect(service.setSkip('u1', skipAt(3))).resolves.toEqual({
      used: true,
      remaining: 0,
    });
    expect(rows).toHaveLength(1);
  });

  it('a replayed write converges to one row', async () => {
    const { service, rows } = makeSkipService(daily);

    for (let i = 0; i < 3; i++) await service.setSkip('u1', skipAt(3));

    expect(rows).toHaveLength(1);
  });

  it('refuses a second skip in the same month', async () => {
    const { service, rows } = makeSkipService(daily);

    await service.setSkip('u1', skipAt(3));
    await expect(service.setSkip('u1', skipAt(9))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(rows).toHaveLength(1);
  });

  it('allows one again the next month — the allowance resets', async () => {
    const { service, rows } = makeSkipService(daily);

    await service.setSkip('u1', skipAt(3, 9));
    await expect(service.setSkip('u1', skipAt(3, 10))).resolves.toEqual({
      used: true,
      remaining: 0,
    });
    expect(rows).toHaveLength(2);
  });

  it('releasing a skip hands it back to the month', async () => {
    const { service, rows } = makeSkipService(daily);

    await service.setSkip('u1', skipAt(3));
    await expect(
      service.setSkip('u1', { ...skipAt(3), used: false }),
    ).resolves.toEqual({ used: false, remaining: 1 });
    expect(rows).toHaveLength(0);

    // …and the released one can be spent elsewhere.
    await expect(service.setSkip('u1', skipAt(9))).resolves.toEqual({
      used: true,
      remaining: 0,
    });
  });

  it('releasing an unspent day is a no-op, not a 404', async () => {
    const { service } = makeSkipService(daily);
    await expect(
      service.setSkip('u1', { ...skipAt(3), used: false }),
    ).resolves.toEqual({ used: false, remaining: 1 });
  });

  it('refuses a skip on a rest day — nothing was due to forgive', async () => {
    // Mon/Wed/Fri. 2026-09-05 is a Saturday.
    const { service, rows } = makeSkipService({
      ...daily,
      daysOfWeek: [1, 3, 5],
    });

    await expect(service.setSkip('u1', skipAt(5))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(rows).toHaveLength(0);

    // …but the Friday before is fair game.
    await expect(service.setSkip('u1', skipAt(4))).resolves.toEqual({
      used: true,
      remaining: 0,
    });
  });

  it('404s an unknown habit and forbids someone else’s', async () => {
    const { service } = makeSkipService(null);
    await expect(service.setSkip('u1', skipAt(3))).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const other = makeSkipService({ ...daily, userId: 'u2' });
    await expect(other.service.setSkip('u1', skipAt(3))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
