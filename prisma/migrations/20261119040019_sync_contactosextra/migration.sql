-- AlterTable
ALTER TABLE "contactosextra_core_partner" ADD COLUMN     "pais_id" TEXT;

-- CreateIndex
CREATE INDEX "contactosextra_core_partner_pais_id_idx" ON "contactosextra_core_partner"("pais_id");

-- AddForeignKey
ALTER TABLE "contactosextra_core_partner" ADD CONSTRAINT "contactosextra_core_partner_pais_id_fkey" FOREIGN KEY ("pais_id") REFERENCES "ubicaciones_pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
