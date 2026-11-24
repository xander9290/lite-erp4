-- AlterTable
ALTER TABLE "directory_partner" ADD COLUMN     "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "directory_partner_parent_id_idx" ON "directory_partner"("parent_id");

-- AddForeignKey
ALTER TABLE "directory_partner" ADD CONSTRAINT "directory_partner_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "directory_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
