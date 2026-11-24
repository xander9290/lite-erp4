-- CreateEnum
CREATE TYPE "directory_partner_partner_type" AS ENUM ('person', 'company');

-- CreateEnum
CREATE TYPE "directory_partner_type" AS ENUM ('contact', 'delivery', 'invoice');

-- CreateTable
CREATE TABLE "directory_partner" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "emails" VARCHAR(200),
    "phones" VARCHAR(200),
    "street" VARCHAR(100),
    "cross_streets" VARCHAR(150),
    "street_number" VARCHAR(10),
    "unit_number" VARCHAR(10),
    "zip_number" TEXT,
    "vat" VARCHAR(13),
    "curp" VARCHAR(18),
    "partner_type" "directory_partner_partner_type" NOT NULL,
    "type" "directory_partner_type" DEFAULT 'contact',
    "image" VARCHAR(2048),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "directory_partner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "directory_partner_create_by_idx" ON "directory_partner"("create_by");

-- AddForeignKey
ALTER TABLE "directory_partner" ADD CONSTRAINT "directory_partner_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
