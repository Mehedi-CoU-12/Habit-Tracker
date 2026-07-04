import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePaymentDto {
  // Whole Taka, matching Payment.amount (Int).
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  amount: number;

  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(300)
  note?: string;
}
