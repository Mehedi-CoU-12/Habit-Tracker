import { IsString, IsInt, Min, Max } from 'class-validator';

export class ToggleLogDto {
  @IsString()
  habitId: string;

  @IsInt()
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
