import { SetMetadata } from '@nestjs/common';

/**
 * Lets an authenticated but not-yet-ACTIVE account (PENDING/SUSPENDED) reach
 * a route the StatusGuard would otherwise block. Applied to `GET /users/me`
 * only: gated clients poll it to show the "waiting for approval" screen and
 * to notice the moment an admin activates the account.
 */
export const ALLOW_INACTIVE = 'allowInactive';
export const AllowInactive = () => SetMetadata(ALLOW_INACTIVE, true);
