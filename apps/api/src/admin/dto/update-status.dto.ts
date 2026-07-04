import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { AccountStatus } from '../../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateStatusDto {
  @IsIn(Object.values(AccountStatus))
  status: AccountStatus;

  // e.g. "paid 500tk cash, June" — stamped onto User.statusNote.
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(300)
  note?: string;
}
