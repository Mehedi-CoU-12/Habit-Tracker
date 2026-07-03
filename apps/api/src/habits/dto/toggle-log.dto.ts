import { IsString, IsInt, Min, Max, IsNotEmpty } from 'class-validator';

export class ToggleLogDto {
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
}
