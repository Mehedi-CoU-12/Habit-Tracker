import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MaxLength(200)
  token: string;

  // Same bounds as SignupDto — a reset must not be able to set a password the
  // login form would then reject.
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  password: string;
}
