/*
  Warnings:

  - You are about to drop the column `address` on the `Building` table. All the data in the column will be lost.
  - Added the required column `location` to the `Building` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Building" DROP COLUMN "address",
ADD COLUMN     "location" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;
