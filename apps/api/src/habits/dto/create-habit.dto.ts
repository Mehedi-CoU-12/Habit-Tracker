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

// Times of day the app understands (matches the Prisma default + templates).
export const TIMES_OF_DAY = [
  'morning',
  'afternoon',
  'evening',
  'anytime',
] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateHabitDto {
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
}
