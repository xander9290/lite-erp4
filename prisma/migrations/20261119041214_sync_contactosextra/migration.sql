-- AlterTable
ALTER TABLE "contactosextra_core_partner" ADD COLUMN     "estado_id" TEXT;

-- CreateIndex
CREATE INDEX "contactosextra_core_partner_estado_id_idx" ON "contactosextra_core_partner"("estado_id");

-- AddForeignKey
ALTER TABLE "contactosextra_core_partner" ADD CONSTRAINT "contactosextra_core_partner_estado_id_fkey" FOREIGN KEY ("estado_id") REFERENCES "ubicaciones_estado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
