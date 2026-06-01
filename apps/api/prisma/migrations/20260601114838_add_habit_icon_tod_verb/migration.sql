-- AlterTable
ALTER TABLE "Habit" ADD COLUMN     "icon" TEXT NOT NULL DEFAULT 'sprout',
ADD COLUMN     "tod" TEXT NOT NULL DEFAULT 'anytime',
ADD COLUMN     "verb" TEXT;
