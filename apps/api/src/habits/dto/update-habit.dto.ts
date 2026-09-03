import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
import { TIMES_OF_DAY, normalizeDaysOfWeek } from './create-habit.dto.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// All fields optional — a PATCH may change any subset of the habit.
export class UpdateHabitDto {
  @IsOptional()
  @IsString()
  @Transform(trim)
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  goal?: number;

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

  // Null clears the target, reverting the habit to binary.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  target?: number | null;

  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(16)
  unit?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  step?: number;

  @IsOptional()
  @IsBoolean()
  fillFromFocus?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @Transform(normalizeDaysOfWeek)
  daysOfWeek?: number[];

  // Archive (true) or restore (false). Modelled as a boolean rather than an
  // exposed timestamp so the client can't invent an archive date; the server
  // stamps it. Archiving keeps every log — deleting is the destructive path.
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
