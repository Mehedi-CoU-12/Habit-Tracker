import { FocusService } from './focus.service.js';
import type { HabitsService } from '../habits/habits.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CacheService } from '../redis/cache.service.js';

type HabitRow = {
  id: string;
  userId: string;
  target: number | null;
  fillFromFocus: boolean;
};

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

type UpsertArg = { create: { amount: number }; update: { amount: number } };

/**
 * The service against an in-memory day cell: `amount` is what the HabitLog for
 * the session's day currently holds (null = no row), and every upsert writes
 * back into it, so a second session in the test sees the first one's result —
 * which is exactly what the clamping assertions need.
 */
function makeService(habit: HabitRow | null, sessions: string[] = []) {
  const cell = { amount: null as number | null };

  const habitLogUpsert = (arg: UpsertArg) => {
    upserts.push(arg);
    cell.amount = arg.update.amount;
    return Promise.resolve({});
  };
  const upserts: UpsertArg[] = [];

  const focusSessionCreate = stub<{ data: { id?: string } }, unknown>();
  const tx = {
    focusSession: {
      create: (arg: { data: { id?: string } }) => {
        if (arg.data.id) sessions.push(arg.data.id);
        return focusSessionCreate(arg);
      },
    },
    habitLog: {
      findUnique: () =>
        Promise.resolve(cell.amount === null ? null : { amount: cell.amount }),
      upsert: habitLogUpsert,
    },
  };

  const prisma = {
    focusSession: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(
          sessions.includes(where.id) ? { id: where.id, userId: 'u1' } : null,
        ),
    },
    habit: { findUnique: stub<unknown, HabitRow | null>(habit) },
    transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;

  const cache = { bumpVersion: stub<unknown>() } as unknown as CacheService;
  const invalidateHabits = stub<string>();
  const habits = { invalidateHabits } as unknown as HabitsService;

  return {
    service: new FocusService(prisma, cache, habits),
    upserts,
    invalidateHabits,
    cell,
  };
}

const session = (id: string, minutes: number) => ({
  id,
  habitId: 'h1',
  minutes,
  year: 2026,
  month: 9,
  day: 3,
});

describe('recordSession auto-log', () => {
  it('logs the minutes against an opted-in quantified habit', async () => {
    const { service, upserts, invalidateHabits } = makeService({
      id: 'h1',
      userId: 'u1',
      target: 30,
      fillFromFocus: true,
    });

    await service.recordSession('u1', session('s1', 25));

    expect(upserts).toHaveLength(1);
    expect(upserts[0].update.amount).toBe(25);
    // The habits cache is stale now too, not just the focus one.
    expect(invalidateHabits.calls).toEqual(['u1']);
  });

  it('clamps at the target rather than overflowing it', async () => {
    const { service, upserts } = makeService({
      id: 'h1',
      userId: 'u1',
      target: 30,
      fillFromFocus: true,
    });

    await service.recordSession('u1', session('s1', 25));
    await service.recordSession('u1', session('s2', 10));

    // 25 + 10 = 35, capped at the 30-minute target.
    expect(upserts.map((u) => u.update.amount)).toEqual([25, 30]);
  });

  it('a replayed session id increments exactly once', async () => {
    const { service, upserts } = makeService({
      id: 'h1',
      userId: 'u1',
      target: 60,
      fillFromFocus: true,
    });

    await service.recordSession('u1', session('s1', 25));
    await service.recordSession('u1', session('s1', 25));
    await service.recordSession('u1', session('s1', 25));

    expect(upserts).toHaveLength(1);
    expect(upserts[0].update.amount).toBe(25);
  });

  it('writes nothing for an opted-out habit', async () => {
    const { service, upserts, invalidateHabits } = makeService({
      id: 'h1',
      userId: 'u1',
      target: 30,
      fillFromFocus: false,
    });

    await service.recordSession('u1', session('s1', 25));

    expect(upserts).toHaveLength(0);
    expect(invalidateHabits.calls).toHaveLength(0);
  });

  it('writes nothing for a binary habit, flag or not', async () => {
    const { service, upserts } = makeService({
      id: 'h1',
      userId: 'u1',
      target: null,
      fillFromFocus: true,
    });

    await service.recordSession('u1', session('s1', 25));

    expect(upserts).toHaveLength(0);
  });

  it('writes nothing for a session bound to no habit', async () => {
    const { service, upserts } = makeService(null);

    await service.recordSession('u1', {
      id: 's1',
      minutes: 25,
      year: 2026,
      month: 9,
      day: 3,
    });

    expect(upserts).toHaveLength(0);
  });

  it('records a session whose habit was deleted, unlinked and unlogged', async () => {
    // findUnique returns null: the habit went away before an offline replay
    // landed. The dedication still counts; nothing is logged.
    const { service, upserts } = makeService(null);

    await service.recordSession('u1', session('s1', 25));

    expect(upserts).toHaveLength(0);
  });
});
