import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

/**
 * Absolute, idempotent amount write for one (habit, date) cell. Zero clears the
 * cell, which is what makes a replayed offline op converge.
 */
export class SetLogAmountDto {
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

  @IsInt()
  @Min(0)
  @Max(100000)
  amount: number;
}
