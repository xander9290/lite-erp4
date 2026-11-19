-- AlterTable
ALTER TABLE "contactosextra_core_partner" ADD COLUMN     "municipio_id" TEXT;

-- CreateIndex
CREATE INDEX "contactosextra_core_partner_municipio_id_idx" ON "contactosextra_core_partner"("municipio_id");

-- AddForeignKey
ALTER TABLE "contactosextra_core_partner" ADD CONSTRAINT "contactosextra_core_partner_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "ubicaciones_municipio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
