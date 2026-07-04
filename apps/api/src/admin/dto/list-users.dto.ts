import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AccountStatus } from '../../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListUsersDto {
  @IsOptional()
  @IsIn(Object.values(AccountStatus))
  status?: AccountStatus;

  // Matches against name OR email, case-insensitively.
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  // Values above the server maximum are clamped, not rejected (pagination.ts).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
