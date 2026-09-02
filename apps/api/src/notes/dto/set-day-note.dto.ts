import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Absolute, idempotent write of one day's note. There is no POST/DELETE pair:
 * a blank `text` clears the day, which lets the mobile outbox replay the same
 * body any number of times and converge — the same reasoning as SetLogDto.
 */
export class SetDayNoteDto {
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

  // Blank is meaningful (it deletes), so this is deliberately not @IsNotEmpty.
  @IsString()
  @Transform(trim)
  @MaxLength(2000)
  text: string;
}
