
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "lastAppPlatform" TEXT,
ADD COLUMN     "lastAppVersion" TEXT;


UPDATE "User" u
SET "lastActiveAt" = l."lastLogAt"
FROM (
  SELECT "userId", MAX("createdAt") AS "lastLogAt"
  FROM "HabitLog"
  GROUP BY "userId"
) l
WHERE u."id" = l."userId";
