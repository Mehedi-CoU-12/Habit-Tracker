-- A deleted account must not take the revenue ledger with it: the payment's
-- user link becomes nullable and SetNull, and the email is denormalized so the
-- surviving row is still attributable.

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey";

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "userId" DROP NOT NULL,
ADD COLUMN     "userEmail" TEXT;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
