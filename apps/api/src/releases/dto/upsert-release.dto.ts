import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Dotted numeric versions only ("1", "1.2", "1.2.3"). The client compares
// these segment-by-segment, so anything it can't parse would silently never
// match — reject it at the door instead.
const VERSION = /^\d+(\.\d+){0,3}$/;
const VERSION_MESSAGE = 'must be a dotted numeric version, e.g. 1.2.0';

export class UpsertReleaseDto {
  @Matches(VERSION, { message: `latest ${VERSION_MESSAGE}` })
  @Transform(trim)
  latest: string;

  // Callers that don't want to force anyone off an old build set this equal
  // to the oldest version they still support (often the very first release).
  @Matches(VERSION, { message: `minimum ${VERSION_MESSAGE}` })
  @Transform(trim)
  minimum: string;

  // Where the app's Update button sends the user: a direct .apk link for the
  // sideloaded builds, or a store listing once it's published.
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @Transform(trim)
  @MaxLength(2000)
  url: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(1000)
  notes?: string;
}
