import {
  buildWeeklyReview,
  computeProgress,
  dayIndexOf,
  HabitHistory,
  indexOfIso,
  localClock,
  MAX_FREEZES,
  reviewWeekStart,
  weekdayOfIndex,
} from './progress.js';

// Monday 2026-09-07 — a fixed anchor so weekdays are predictable.
const MON = dayIndexOf(2026, 9, 7);

function habit(over: Partial<HabitHistory> = {}): HabitHistory {
  return {
    id: 'h1',
    name: 'Reading',
    icon: 'book',
    daysOfWeek: [],
    planted: MON,
    retired: Infinity,
    done: new Set(),
    skipped: new Set(),
    ...over,
  };
}

/** Days MON+from .. MON+to inclusive. */
const run = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => MON + from + i);

describe('day helpers', () => {
  it('knows the anchor is a Monday', () => {
    expect(weekdayOfIndex(MON)).toBe(1);
  });

  it('parses ISO dates and rejects impossible ones', () => {
    expect(indexOfIso('2026-09-07')).toBe(MON);
    expect(indexOfIso('2026-02-30')).toBeNull();
    expect(indexOfIso('nope')).toBeNull();
  });

  it('reads the wall clock in a zone', () => {
    // 20:00 UTC on Sunday Sep 13 is already Monday 02:00 in Dhaka.
    const at = new Date(Date.UTC(2026, 8, 13, 20));
    expect(localClock(at, 'UTC')).toMatchObject({ weekday: 0, hour: 20 });
    expect(localClock(at, 'Asia/Dhaka')).toMatchObject({
      index: MON + 7,
      weekday: 1,
      hour: 2,
    });
    expect(localClock(at, 'Not/AZone').weekday).toBe(0);
  });
});

describe('computeProgress', () => {
  it('carries a streak across a month boundary', () => {
    const planted = dayIndexOf(2026, 8, 25);
    const h = habit({
      planted,
      done: new Set(run(planted - MON, 0)),
    });
    expect(computeProgress(h, MON + 1).streak).toBe(14);
  });

  it('leaves today out of the streak', () => {
    const h = habit({ done: new Set(run(0, 3)) });
    // Today (MON+3) is done but still open.
    expect(computeProgress(h, MON + 3).streak).toBe(3);
  });

  it('earns a freeze at 7 and spends it on the next miss', () => {
    const done = new Set([...run(0, 6), ...run(8, 9)]);
    const p = computeProgress(habit({ done }), MON + 10);
    expect(p.frozen).toEqual([MON + 7]);
    expect(p.streak).toBe(9);
    expect(p.freezes).toBe(0);
  });

  it('breaks the streak on a miss with no freeze banked', () => {
    const done = new Set([...run(0, 5), ...run(7, 8)]);
    const p = computeProgress(habit({ done }), MON + 9);
    expect(p.frozen).toEqual([]);
    expect(p.streak).toBe(2);
    expect(p.longest).toBe(6);
  });

  it('hands the freeze back when the frozen day is backfilled', () => {
    const done = new Set([...run(0, 6), ...run(8, 9)]);
    const before = computeProgress(habit({ done }), MON + 10);
    done.add(MON + 7);
    const after = computeProgress(habit({ done }), MON + 10);
    expect(before.freezes).toBe(0);
    expect(after.frozen).toEqual([]);
    expect(after.freezes).toBe(1);
    expect(after.streak).toBe(10);
  });

  it('caps the bank', () => {
    const p = computeProgress(habit({ done: new Set(run(0, 34)) }), MON + 35);
    expect(p.freezes).toBe(MAX_FREEZES);
  });

  it('does not spend a freeze on a skipped or rest day', () => {
    const done = new Set([...run(0, 6), ...run(8, 8)]);
    const skipped = new Set([MON + 7]);
    const p = computeProgress(habit({ done, skipped }), MON + 9);
    expect(p.frozen).toEqual([]);
    expect(p.freezes).toBe(1);
    expect(p.streak).toBe(8);

    // Mon/Wed/Fri: the days between are not owed at all.
    const mwf = habit({
      daysOfWeek: [1, 3, 5],
      done: new Set([MON, MON + 2, MON + 4, MON + 7]),
    });
    expect(computeProgress(mwf, MON + 8).streak).toBe(4);
  });

  it('records milestones as they are reached', () => {
    const p = computeProgress(habit({ done: new Set(run(0, 29)) }), MON + 30);
    expect(p.milestones).toEqual([
      { days: 7, at: MON + 6 },
      { days: 30, at: MON + 29 },
    ]);
  });

  it('stops at the archive date', () => {
    const h = habit({ done: new Set(run(0, 2)), retired: MON + 2 });
    const p = computeProgress(h, MON + 20);
    expect(p.streak).toBe(3);
    expect(p.frozen).toEqual([]);
  });
});

describe('buildWeeklyReview', () => {
  it('reviews the week ending on the latest Sunday', () => {
    const sunday = MON + 13;
    expect(reviewWeekStart(sunday)).toBe(MON + 7);
    // Monday reads the week that just finished.
    expect(reviewWeekStart(MON + 14)).toBe(MON + 7);
  });

  it('counts due days and flags a best week', () => {
    const reading = habit({
      // 3/7 in week one, 5/7 in week two.
      done: new Set([...run(0, 2), ...run(7, 11)]),
    });
    const r = buildWeeklyReview([reading], MON + 13);
    expect(r.weekStart).toBe('2026-09-14');
    expect(r.habits[0]).toMatchObject({ done: 5, due: 7, bestWeek: true });
    expect(r.bestWeek).toBe(true);
    expect(r.highlight).toBe('5/7 days on Reading, best week yet 🌸');
  });

  it('does not call a first week a best week', () => {
    const r = buildWeeklyReview(
      [habit({ planted: MON + 7, done: new Set(run(7, 13)) })],
      MON + 13,
    );
    expect(r.bestWeek).toBe(false);
    expect(r.perfectDays).toBe(7);
    expect(r.highlight).toBe('7/7 days on Reading');
    expect(r.milestones).toEqual([{ habitId: 'h1', name: 'Reading', days: 7 }]);
  });

  it('reports freezes that saved a streak this week', () => {
    const done = new Set([...run(0, 6), ...run(8, 13)]);
    const r = buildWeeklyReview([habit({ done })], MON + 13);
    expect(r.freezesUsed).toBe(1);
  });

  it('is empty when nothing was owed', () => {
    const r = buildWeeklyReview([habit({ planted: MON + 30 })], MON + 13);
    expect(r).toMatchObject({ due: 0, highlight: null, habits: [] });
  });
});
