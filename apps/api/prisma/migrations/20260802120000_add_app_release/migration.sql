-- CreateEnum
CREATE TYPE "AppPlatform" AS ENUM ('ANDROID', 'IOS');

-- CreateTable
CREATE TABLE "AppRelease" (
    "id" TEXT NOT NULL,
    "platform" "AppPlatform" NOT NULL,
    "latest" TEXT NOT NULL,
    "minimum" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "notes" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppRelease_platform_key" ON "AppRelease"("platform");
