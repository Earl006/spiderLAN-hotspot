/*
  Warnings:

  - You are about to drop the column `buildingId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_buildingId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "buildingId",
DROP COLUMN "name",
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "macAddress" TEXT,
ADD COLUMN     "username" TEXT;
