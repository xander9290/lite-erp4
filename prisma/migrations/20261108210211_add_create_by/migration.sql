-- AlterTable
ALTER TABLE "flota_records" ADD COLUMN     "create_by" TEXT;

-- CreateIndex
CREATE INDEX "flota_records_create_by_idx" ON "flota_records"("create_by");

-- AddForeignKey
ALTER TABLE "flota_records" ADD CONSTRAINT "flota_records_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
