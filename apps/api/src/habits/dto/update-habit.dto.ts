import {
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
import { TIMES_OF_DAY } from './create-habit.dto.js';

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
}
