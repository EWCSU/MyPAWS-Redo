-- AlterTable
ALTER TABLE "users" ADD COLUMN     "twoFactorCode" TEXT,
ADD COLUMN     "twoFactorExpires" TIMESTAMP(3);
