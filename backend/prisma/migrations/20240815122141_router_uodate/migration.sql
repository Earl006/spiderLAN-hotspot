/*
  Warnings:

  - Added the required column `password` to the `Router` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `Router` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Router" ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "username" TEXT NOT NULL;
