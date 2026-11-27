-- AlterTable
ALTER TABLE "directory_partner" ADD COLUMN     "is_customer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_supplier" BOOLEAN NOT NULL DEFAULT false;
