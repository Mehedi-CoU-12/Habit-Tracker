-- Opt-in per habit: a focus session bound to it logs its minutes against the
-- day's target. Defaulted false, so every existing habit is opted out.

-- AlterTable
ALTER TABLE "Habit" ADD COLUMN     "fillFromFocus" BOOLEAN NOT NULL DEFAULT false;
