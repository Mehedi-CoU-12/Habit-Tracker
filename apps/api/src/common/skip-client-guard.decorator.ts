import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route (or controller) as reachable without the app-client check.
 * Used for endpoints a browser or third party must be able to hit directly
 * without our custom header: the health check (self-ping / Render probe) and
 * the Google OAuth redirect endpoints (top-level browser navigations and
 * Google's own callback carry neither our Origin nor our client key).
 */
export const SKIP_CLIENT_GUARD = 'skipClientGuard';
export const SkipClientGuard = () => SetMetadata(SKIP_CLIENT_GUARD, true);
