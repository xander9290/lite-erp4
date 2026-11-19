-- AlterTable
ALTER TABLE "contactosextra_core_partner" ADD COLUMN     "localidad_id" TEXT;

-- CreateIndex
CREATE INDEX "contactosextra_core_partner_localidad_id_idx" ON "contactosextra_core_partner"("localidad_id");

-- AddForeignKey
ALTER TABLE "contactosextra_core_partner" ADD CONSTRAINT "contactosextra_core_partner_localidad_id_fkey" FOREIGN KEY ("localidad_id") REFERENCES "ubicaciones_localidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
