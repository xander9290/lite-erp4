-- AlterTable
ALTER TABLE "contactosextra_core_partner" ADD COLUMN     "purchase_user_id" TEXT,
ADD COLUMN     "sale_user_id" TEXT;

-- CreateIndex
CREATE INDEX "contactosextra_core_partner_sale_user_id_idx" ON "contactosextra_core_partner"("sale_user_id");

-- CreateIndex
CREATE INDEX "contactosextra_core_partner_purchase_user_id_idx" ON "contactosextra_core_partner"("purchase_user_id");

-- AddForeignKey
ALTER TABLE "contactosextra_core_partner" ADD CONSTRAINT "contactosextra_core_partner_sale_user_id_fkey" FOREIGN KEY ("sale_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactosextra_core_partner" ADD CONSTRAINT "contactosextra_core_partner_purchase_user_id_fkey" FOREIGN KEY ("purchase_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
