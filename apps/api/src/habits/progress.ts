/** Whole-history streaks, freezes, milestones and the weekly review, on local day indices. */

/** A freeze is earned each time the streak reaches a multiple of this. */
export const FREEZE_EVERY = 7;

/** Freezes one habit can bank. */
export const MAX_FREEZES = 2;

/** Streak lengths that bloom the plant and earn a badge. */
export const MILESTONES = [7, 30, 100] as const;

const DAY_MS = 86_400_000;

export function dayIndexOf(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** 0 = Sunday. 1970-01-01 was a Thursday. */
export function weekdayOfIndex(index: number): number {
  return (((index + 4) % 7) + 7) % 7;
}

export function ymdOfIndex(index: number): {
  year: number;
  month: number;
  day: number;
} {
  const d = new Date(index * DAY_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

export function isoOfIndex(index: number): string {
  return new Date(index * DAY_MS).toISOString().slice(0, 10);
}

/** "2026-09-29" → day index, or null when it isn't a real date. */
export function indexOfIso(iso: string | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const index = dayIndexOf(year, month, day);
  const back = ymdOfIndex(index);
  return back.month === month && back.day === day ? index : null;
}

/** Whether `tz` is an IANA zone this runtime can format in. */
export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of an instant in a zone; UTC when the zone is unusable. */
export function localClock(
  at: Date,
  tz?: string | null,
): { index: number; weekday: number; hour: number } {
  const zone = isValidTimeZone(tz) ? tz : 'UTC';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const index = dayIndexOf(get('year'), get('month'), get('day'));
  return { index, weekday: weekdayOfIndex(index), hour: get('hour') % 24 };
}

/** Local day index an instant falls on. */
export function localDayIndex(at: Date, tz?: string | null): number {
  return localClock(at, tz).index;
}

export function isDue(daysOfWeek: number[], index: number): boolean {
  return daysOfWeek.length === 0 || daysOfWeek.includes(weekdayOfIndex(index));
}

/** One habit's history, reduced to what the maths needs. */
export type HabitHistory = {
  id: string;
  name: string;
  icon: string;
  daysOfWeek: number[];
  /** First day the habit can be judged on. */
  planted: number;
  /** Last day it was owed; Infinity while it is active. */
  retired: number;
  /** Days whose log reached the target. */
  done: Set<number>;
  /** Days forgiven by a user-spent skip. */
  skipped: Set<number>;
};

export type HabitProgress = {
  /** Streak carried into `today`, today itself excluded. */
  streak: number;
  /** Longest streak ever, today excluded. */
  longest: number;
  /** Freezes banked going into `today`. */
  freezes: number;
  /** Missed due days a freeze was spent on. */
  frozen: number[];
  /** Each time the streak reached a milestone, and on which day. */
  milestones: { days: number; at: number }[];
};

/** Walk planting → yesterday: done grows the streak, a miss spends a freeze or breaks it. */
export function computeProgress(h: HabitHistory, today: number): HabitProgress {
  let streak = 0;
  let longest = 0;
  let freezes = 0;
  const frozen: number[] = [];
  const milestones: { days: number; at: number }[] = [];
  const end = Math.min(today - 1, h.retired);

  for (let d = h.planted; d <= end; d++) {
    if (!isDue(h.daysOfWeek, d)) continue;
    if (h.done.has(d)) {
      streak++;
      if (streak > longest) longest = streak;
      if (streak % FREEZE_EVERY === 0)
        freezes = Math.min(MAX_FREEZES, freezes + 1);
      if ((MILESTONES as readonly number[]).includes(streak))
        milestones.push({ days: streak, at: d });
      continue;
    }
    if (h.skipped.has(d)) continue;
    if (freezes > 0) {
      freezes--;
      frozen.push(d);
      continue;
    }
    streak = 0;
  }

  return { streak, longest, freezes, frozen, milestones };
}

export type WeeklyHabitReview = {
  id: string;
  name: string;
  icon: string;
  done: number;
  due: number;
  rate: number;
  /** More done days than in any earlier week of this habit. */
  bestWeek: boolean;
};

export type WeeklyReview = {
  weekStart: string;
  weekEnd: string;
  done: number;
  due: number;
  rate: number;
  /** Days where every habit owed that day was done. */
  perfectDays: number;
  /** The highest overall rate of any week so far. */
  bestWeek: boolean;
  /** Freezes that saved a streak this week. */
  freezesUsed: number;
  milestones: { habitId: string; name: string; days: number }[];
  /** "5/7 days on Reading, best week yet 🌸" — null for an empty week. */
  highlight: string | null;
  habits: WeeklyHabitReview[];
};

/** Monday that opens the review week: the week ending on the latest Sunday. */
export function reviewWeekStart(today: number): number {
  const sinceSunday = weekdayOfIndex(today);
  return today - sinceSunday - 6;
}

const rateOf = (done: number, due: number) =>
  due === 0 ? 0 : Math.round((done / due) * 100);

/** One habit's done/due inside [from, to], counting due days only. */
function tally(h: HabitHistory, from: number, to: number) {
  let done = 0;
  let due = 0;
  const start = Math.max(from, h.planted);
  const end = Math.min(to, h.retired);
  for (let d = start; d <= end; d++) {
    if (!isDue(h.daysOfWeek, d)) continue;
    due++;
    if (h.done.has(d)) done++;
  }
  return { done, due };
}

/** Review of the Monday–Sunday week ending on the latest Sunday on or before `today`. */
export function buildWeeklyReview(
  habits: HabitHistory[],
  today: number,
): WeeklyReview {
  const weekStart = reviewWeekStart(today);
  const weekEnd = weekStart + 6;
  const to = Math.min(weekEnd, today);

  const rows: WeeklyHabitReview[] = [];
  for (const h of habits) {
    const { done, due } = tally(h, weekStart, to);
    if (due === 0) continue;
    let prevBest = -1;
    for (let w = weekStart - 7; w + 6 >= h.planted; w -= 7) {
      const prior = tally(h, w, w + 6);
      if (prior.due > 0) prevBest = Math.max(prevBest, prior.done);
    }
    rows.push({
      id: h.id,
      name: h.name,
      icon: h.icon,
      done,
      due,
      rate: rateOf(done, due),
      bestWeek: prevBest >= 0 && done > prevBest,
    });
  }
  rows.sort((a, b) => b.rate - a.rate || b.done - a.done);

  const done = rows.reduce((s, r) => s + r.done, 0);
  const due = rows.reduce((s, r) => s + r.due, 0);
  const rate = rateOf(done, due);

  let perfectDays = 0;
  for (let d = weekStart; d <= to; d++) {
    const owed = habits.filter(
      (h) => d >= h.planted && d <= h.retired && isDue(h.daysOfWeek, d),
    );
    if (owed.length > 0 && owed.every((h) => h.done.has(d))) perfectDays++;
  }

  const earliest = Math.min(...habits.map((h) => h.planted), weekStart);
  let prevBestRate = -1;
  for (let w = weekStart - 7; w + 6 >= earliest; w -= 7) {
    let wd = 0;
    let wdue = 0;
    for (const h of habits) {
      const t = tally(h, w, w + 6);
      wd += t.done;
      wdue += t.due;
    }
    if (wdue > 0) prevBestRate = Math.max(prevBestRate, rateOf(wd, wdue));
  }

  let freezesUsed = 0;
  const milestones: WeeklyReview['milestones'] = [];
  for (const h of habits) {
    const frozen = computeProgress(h, today).frozen;
    freezesUsed += frozen.filter((d) => d >= weekStart).length;
    for (const m of computeProgress(h, to + 1).milestones)
      if (m.at >= weekStart)
        milestones.push({ habitId: h.id, name: h.name, days: m.days });
  }

  const star =
    rows.filter((r) => r.bestWeek).sort((a, b) => b.done - a.done)[0] ??
    rows[0];
  const highlight = star
    ? `${star.done}/${star.due} days on ${star.name}${star.bestWeek ? ', best week yet 🌸' : ''}`
    : null;

  return {
    weekStart: isoOfIndex(weekStart),
    weekEnd: isoOfIndex(weekEnd),
    done,
    due,
    rate,
    perfectDays,
    bestWeek: due > 0 && prevBestRate >= 0 && rate > prevBestRate,
    freezesUsed,
    milestones,
    highlight,
    habits: rows,
  };
}
