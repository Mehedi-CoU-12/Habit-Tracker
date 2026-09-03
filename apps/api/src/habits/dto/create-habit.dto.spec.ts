import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateHabitDto, normalizeDaysOfWeek } from './create-habit.dto.js';
import { UpdateHabitDto } from './update-habit.dto.js';

const norm = (value: unknown) => normalizeDaysOfWeek({ value });

describe('normalizeDaysOfWeek', () => {
  it('dedupes and sorts', () => {
    expect(norm([5, 1, 3, 1])).toEqual([1, 3, 5]);
    expect(norm([6, 6, 0])).toEqual([0, 6]);
  });

  it('collapses all seven days to the empty list', () => {
    expect(norm([0, 1, 2, 3, 4, 5, 6])).toEqual([]);
    expect(norm([6, 5, 4, 3, 2, 1, 0])).toEqual([]);
  });

  it('leaves an already-canonical list alone', () => {
    expect(norm([])).toEqual([]);
    expect(norm([1])).toEqual([1]);
    expect(norm([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
  });

  it('passes invalid input through untouched so the validators report it', () => {
    // Silently dropping these would turn a bad request into a silent no-op.
    expect(norm([7])).toEqual([7]);
    expect(norm([-1])).toEqual([-1]);
    expect(norm([2.5])).toEqual([2.5]);
    expect(norm([1, 7])).toEqual([1, 7]);
    expect(norm(['1'])).toEqual(['1']);
    expect(norm([null])).toEqual([null]);
  });

  it('passes non-arrays through untouched', () => {
    expect(norm('nope')).toBe('nope');
    expect(norm(42)).toBe(42);
    expect(norm(undefined)).toBeUndefined();
    expect(norm(null)).toBeNull();
  });
});

/** Run a payload through the same transform + validate the pipe applies. */
function check<T extends object>(cls: new () => T, payload: unknown) {
  const dto = plainToInstance(cls, payload);
  return { dto, errors: validateSync(dto as object) };
}

describe('CreateHabitDto daysOfWeek', () => {
  it('normalizes a valid schedule and passes validation', () => {
    const { dto, errors } = check(CreateHabitDto, {
      name: 'Gym',
      goal: 12,
      daysOfWeek: [5, 1, 3, 1],
    });
    expect(errors).toHaveLength(0);
    expect(dto.daysOfWeek).toEqual([1, 3, 5]);
  });

  it('accepts a habit with no schedule', () => {
    const { dto, errors } = check(CreateHabitDto, { name: 'Water', goal: 30 });
    expect(errors).toHaveLength(0);
    expect(dto.daysOfWeek).toBeUndefined();
  });

  it('rejects a weekday out of range', () => {
    for (const bad of [[7], [-1], [0, 7]]) {
      const { errors } = check(CreateHabitDto, {
        name: 'Bad',
        goal: 5,
        daysOfWeek: bad,
      });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects a non-integer weekday', () => {
    const { errors } = check(CreateHabitDto, {
      name: 'Bad',
      goal: 5,
      daysOfWeek: [2.5],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts over-long input whose duplicates dedupe away', () => {
    // The transform runs before validation, so eight entries covering the
    // whole week normalize to "daily" rather than tripping ArrayMaxSize.
    const { dto, errors } = check(CreateHabitDto, {
      name: 'Every day',
      goal: 5,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6, 0],
    });
    expect(errors).toHaveLength(0);
    expect(dto.daysOfWeek).toEqual([]);
  });

  it('still rejects an over-long array it cannot normalize', () => {
    // Invalid content passes through the transform untouched, so both the
    // size and the range validators get to report.
    const { errors } = check(CreateHabitDto, {
      name: 'Bad',
      goal: 5,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6, 9],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('UpdateHabitDto', () => {
  it('normalizes daysOfWeek the same way create does', () => {
    const { dto, errors } = check(UpdateHabitDto, { daysOfWeek: [5, 1, 3] });
    expect(errors).toHaveLength(0);
    expect(dto.daysOfWeek).toEqual([1, 3, 5]);
  });

  it('accepts archived as a boolean', () => {
    for (const archived of [true, false]) {
      const { dto, errors } = check(UpdateHabitDto, { archived });
      expect(errors).toHaveLength(0);
      expect(dto.archived).toBe(archived);
    }
  });

  it('rejects a non-boolean archived', () => {
    const { errors } = check(UpdateHabitDto, { archived: 'yes' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('an empty patch is valid — every field is optional', () => {
    const { errors } = check(UpdateHabitDto, {});
    expect(errors).toHaveLength(0);
  });
});
