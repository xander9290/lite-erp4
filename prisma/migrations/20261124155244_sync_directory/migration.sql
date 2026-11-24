-- AlterTable
ALTER TABLE "directory_partner" ADD COLUMN     "sale_user_id" TEXT;

-- CreateIndex
CREATE INDEX "directory_partner_sale_user_id_idx" ON "directory_partner"("sale_user_id");

-- AddForeignKey
ALTER TABLE "directory_partner" ADD CONSTRAINT "directory_partner_sale_user_id_fkey" FOREIGN KEY ("sale_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
