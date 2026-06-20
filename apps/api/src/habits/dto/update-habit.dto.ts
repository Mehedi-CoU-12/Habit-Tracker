import {
  IsString,
  IsInt,
  Min,
  Max,
  MinLength,
  IsOptional,
} from 'class-validator';

// All fields optional — a PATCH may change any subset of the habit.
export class UpdateHabitDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  goal?: number;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  tod?: string;

  @IsOptional()
  @IsString()
  verb?: string;
}
