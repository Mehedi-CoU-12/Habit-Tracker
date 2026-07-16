import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body for POST /auth/google/exchange (mobile deep-link code → tokens). */
export class GoogleExchangeDto {
  @IsString()
  @IsNotEmpty()
  // The code is a short-lived signed JWT; cap generously to reject junk.
  @MaxLength(2000)
  code: string;
}
