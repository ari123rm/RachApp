/*
  Warnings:

  - Made the column `phone` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verification_code" TEXT,
ALTER COLUMN "phone" SET NOT NULL;
