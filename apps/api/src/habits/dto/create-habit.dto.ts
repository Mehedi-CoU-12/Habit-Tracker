import {
  ArrayMaxSize,
  IsArray,
  IsString,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Times of day the app understands (matches the Prisma default + templates).
export const TIMES_OF_DAY = [
  'morning',
  'afternoon',
  'evening',
  'anytime',
] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const isUnknownArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

/**
 * Canonicalize a weekday schedule: dedupe, sort, and collapse "all seven days"
 * to the empty list, which is the single stored spelling of "daily". Anything
 * that isn't already a clean list of ints passes through untouched so the
 * validators below report it rather than this silently swallowing it.
 */
export const normalizeDaysOfWeek = ({ value }: { value: unknown }) => {
  if (!isUnknownArray(value)) return value;
  const days = value.filter(
    (v): v is number =>
      typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6,
  );

  if (days.length !== value.length) return value;
  const unique = [...new Set(days)].sort((a, b) => a - b);
  return unique.length === 7 ? [] : unique;
};

export class CreateHabitDto {
  // Optional client-generated id (mobile offline create). When present the
  // server adopts it as the primary key, which makes create idempotent on
  // retry. Bounded so it can't be abused as an arbitrary blob.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsInt()
  @Min(1)
  @Max(31)
  goal: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  @IsOptional()
  @IsString()
  @IsIn(TIMES_OF_DAY)
  tod?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(50)
  verb?: string;

  // Weekdays the habit is expected on, 0 = Sunday. Omitted or empty means
  // every day. Callers never need to send all seven — that normalizes to [].
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @Transform(normalizeDaysOfWeek)
  daysOfWeek?: number[];
}
