import { IsString, IsInt, Min, Max, MinLength } from 'class-validator';

export class CreateHabitDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsInt()
  @Min(1)
  @Max(31)
  goal: number;
}
