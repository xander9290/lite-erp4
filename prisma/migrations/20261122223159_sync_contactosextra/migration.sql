-- AlterTable
ALTER TABLE "contactosextra_core_partner" ADD COLUMN     "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "contactosextra_core_partner_parent_id_idx" ON "contactosextra_core_partner"("parent_id");

-- AddForeignKey
ALTER TABLE "contactosextra_core_partner" ADD CONSTRAINT "contactosextra_core_partner_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
