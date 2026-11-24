-- CreateTable
CREATE TABLE "directory_partner_activity_ids_rel" (
    "source_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,

    CONSTRAINT "directory_partner_activity_ids_rel_pkey" PRIMARY KEY ("source_id","target_id")
);

-- CreateIndex
CREATE INDEX "directory_partner_activity_ids_rel_target_id_idx" ON "directory_partner_activity_ids_rel"("target_id");

-- AddForeignKey
ALTER TABLE "directory_partner_activity_ids_rel" ADD CONSTRAINT "directory_partner_activity_ids_rel_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "directory_partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_partner_activity_ids_rel" ADD CONSTRAINT "directory_partner_activity_ids_rel_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "directory_businessactivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
