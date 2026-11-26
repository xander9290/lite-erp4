-- CreateEnum
CREATE TYPE "directory_partneremails_usage" AS ENUM ('billing', 'collection', 'purchasing', 'sales', 'logistics', 'general');

-- AlterTable
ALTER TABLE "directory_partneremails" ADD COLUMN     "send_documents" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "usage" "directory_partneremails_usage" NOT NULL DEFAULT 'general';
