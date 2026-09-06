-- "Last active" was derived from the newest HabitLog, so an account that
-- signed in daily but checked nothing off read as "—". It's now stamped on
-- every authenticated request (ActivityInterceptor), along with the client
-- build that request came from, so the admin list can show both.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "lastAppPlatform" TEXT,
ADD COLUMN     "lastAppVersion" TEXT;

-- Backfill from the signal the old derivation used, so existing accounts keep
-- the last-active date they already showed instead of resetting to "—" until
-- their next request. Version/platform stay null: nothing recorded them
-- before now, and a guess would be worse than an honest blank.
UPDATE "User" u
SET "lastActiveAt" = l."lastLogAt"
FROM (
  SELECT "userId", MAX("createdAt") AS "lastLogAt"
  FROM "HabitLog"
  GROUP BY "userId"
) l
WHERE u."id" = l."userId";
