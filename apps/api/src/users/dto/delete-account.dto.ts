import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Proof of intent for an irreversible delete. A password account supplies its
 * current password; a Google-only account has none to give, so it types the
 * word DELETE instead. Both fields are optional here and the service decides
 * which one this account actually owes — `forbidNonWhitelisted` means an
 * undecorated field would be rejected outright, so both must be declared.
 */
export class DeleteAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  confirmation?: string;
}
