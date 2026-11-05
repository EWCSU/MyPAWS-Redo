/*
  Warnings:

  - You are about to alter the column `credits` on the `audit_courses` table. The data in that column could be lost. The data in that column will be cast from `Decimal(8,2)` to `Decimal(10,5)`.

*/
-- AlterTable
ALTER TABLE "audit_courses" ALTER COLUMN "credits" SET DATA TYPE DECIMAL(10,5);
