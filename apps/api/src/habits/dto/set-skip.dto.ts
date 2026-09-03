import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Absolute, idempotent skip write for one (habit, date) cell — the same shape
 * and contract as SetLogDto, so a replayed outbox op converges instead of
 * toggling. `used: false` releases the skip back to the month's allowance.
 */
export class SetSkipDto {
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
  used: boolean;
}
