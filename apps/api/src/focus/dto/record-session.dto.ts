import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * One completed focus session, reported by the client when the timer hits
 * zero. year/month/day are the client's local calendar day (the HabitLog
 * convention). The optional client-generated id makes the write idempotent —
 * the mobile outbox can replay it after a crash without double-counting.
 */
export class RecordSessionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  habitId?: string;

  @IsInt()
  @Min(1)
  @Max(240)
  minutes: number;

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
}
