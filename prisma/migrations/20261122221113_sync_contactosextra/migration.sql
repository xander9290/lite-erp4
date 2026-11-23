-- CreateEnum
CREATE TYPE "contactosextra_core_partner_partner_type" AS ENUM ('contact', 'delivery', 'invoice');

-- AlterTable
ALTER TABLE "contactosextra_core_partner" ADD COLUMN     "partner_type" "contactosextra_core_partner_partner_type" NOT NULL DEFAULT 'contact';
