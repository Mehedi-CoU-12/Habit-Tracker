import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body for POST /auth/refresh and POST /auth/logout. */
export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  // Signed JWTs are a few hundred chars; cap generously to reject junk bodies.
  @MaxLength(2000)
  refreshToken: string;
}
