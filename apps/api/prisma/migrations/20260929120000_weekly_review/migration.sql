-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "weeklyReviewEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "weeklyReviewSentFor" TEXT;
