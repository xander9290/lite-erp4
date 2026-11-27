-- AlterTable
ALTER TABLE "company_company" ADD COLUMN     "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "company_company_parent_id_idx" ON "company_company"("parent_id");

-- AddForeignKey
ALTER TABLE "company_company" ADD CONSTRAINT "company_company_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "company_company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
