-- Signups are auto-approved: new rows land ACTIVE instead of PENDING.
-- Deliberately no backfill — accounts already sitting in PENDING (or
-- SUSPENDED) stay put; that call belongs to the admin, not this migration.

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
