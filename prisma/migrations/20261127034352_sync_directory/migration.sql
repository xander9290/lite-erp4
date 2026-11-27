-- CreateEnum
CREATE TYPE "directory_partnerphones_type" AS ENUM ('mobile', 'landline', 'other');

-- CreateEnum
CREATE TYPE "directory_partnerphones_usage" AS ENUM ('sales', 'purchase', 'collection', 'logistics', 'general');

-- CreateTable
CREATE TABLE "directory_partnerphones" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "type" "directory_partnerphones_type",
    "usage" "directory_partnerphones_usage" NOT NULL,
    "contact" TEXT,
    "extension" TEXT,
    "partner_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "directory_partnerphones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "directory_partnerphones_partner_id_idx" ON "directory_partnerphones"("partner_id");

-- CreateIndex
CREATE INDEX "directory_partnerphones_create_by_idx" ON "directory_partnerphones"("create_by");

-- AddForeignKey
ALTER TABLE "directory_partnerphones" ADD CONSTRAINT "directory_partnerphones_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "directory_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_partnerphones" ADD CONSTRAINT "directory_partnerphones_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
