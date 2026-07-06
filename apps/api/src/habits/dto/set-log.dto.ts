import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Absolute, idempotent form of a log write: set the completion state for a
 * (habit, date) cell to an explicit boolean, rather than the relative flip of
 * ToggleLogDto. Idempotent replays are what make offline sync safe — the mobile
 * outbox can resend "day 5 = done" any number of times and converge.
 */
export class SetLogDto {
  @IsString()
  @IsNotEmpty()
  habitId: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(1)
  @Max(31)
  day: number;

  @IsBoolean()
  completed: boolean;
}
