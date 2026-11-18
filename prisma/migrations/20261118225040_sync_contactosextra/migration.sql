-- CreateTable
CREATE TABLE "contactosextra_core_partner" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "street" VARCHAR(160),
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contactosextra_core_partner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contactosextra_core_partner_record_id_key" ON "contactosextra_core_partner"("record_id");

-- CreateIndex
CREATE INDEX "contactosextra_core_partner_create_by_idx" ON "contactosextra_core_partner"("create_by");

-- AddForeignKey
ALTER TABLE "contactosextra_core_partner" ADD CONSTRAINT "contactosextra_core_partner_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactosextra_core_partner" ADD CONSTRAINT "contactosextra_core_partner_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
