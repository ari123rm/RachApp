/*
  Warnings:

  - You are about to drop the column `created_at` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `paid_by` on the `Expense` table. All the data in the column will be lost.
  - The primary key for the `ExpenseParticipant` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `user_id` on the `ExpenseParticipant` table. All the data in the column will be lost.
  - Added the required column `user_id` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `friend_id` to the `ExpenseParticipant` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_group_id_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_paid_by_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseParticipant" DROP CONSTRAINT "ExpenseParticipant_user_id_fkey";

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "created_at",
DROP COLUMN "paid_by",
ADD COLUMN     "user_id" TEXT NOT NULL,
ALTER COLUMN "group_id" DROP NOT NULL,
ALTER COLUMN "expense_date" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ExpenseParticipant" DROP CONSTRAINT "ExpenseParticipant_pkey",
DROP COLUMN "user_id",
ADD COLUMN     "friend_id" TEXT NOT NULL,
ADD CONSTRAINT "ExpenseParticipant_pkey" PRIMARY KEY ("expense_id", "friend_id");

-- CreateTable
CREATE TABLE "Friend" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "color" TEXT NOT NULL,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Friend_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Friend" ADD CONSTRAINT "Friend_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseParticipant" ADD CONSTRAINT "ExpenseParticipant_friend_id_fkey" FOREIGN KEY ("friend_id") REFERENCES "Friend"("id") ON DELETE CASCADE ON UPDATE CASCADE;
