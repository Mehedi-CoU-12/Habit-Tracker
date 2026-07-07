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
}
