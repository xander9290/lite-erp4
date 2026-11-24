-- AlterTable
ALTER TABLE "directory_businessactivity" ADD COLUMN     "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "directory_businessactivity_parent_id_idx" ON "directory_businessactivity"("parent_id");

-- AddForeignKey
ALTER TABLE "directory_businessactivity" ADD CONSTRAINT "directory_businessactivity_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "directory_businessactivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
