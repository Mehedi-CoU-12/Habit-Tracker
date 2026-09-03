-- Streak insurance: one row per deliberately forgiven day. A new table, so no
-- existing row changes and no backfill — every historical streak is unchanged
-- until a user spends their first skip.

-- CreateTable
CREATE TABLE "HabitSkip" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabitSkip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HabitSkip_userId_year_month_idx" ON "HabitSkip"("userId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "HabitSkip_habitId_year_month_day_key" ON "HabitSkip"("habitId", "year", "month", "day");

-- AddForeignKey
ALTER TABLE "HabitSkip" ADD CONSTRAINT "HabitSkip_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
