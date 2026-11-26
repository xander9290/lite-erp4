-- CreateTable
CREATE TABLE "directory_partneremails" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "partner_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "directory_partneremails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "directory_partneremails_name_key" ON "directory_partneremails"("name");

-- CreateIndex
CREATE INDEX "directory_partneremails_partner_id_idx" ON "directory_partneremails"("partner_id");

-- CreateIndex
CREATE INDEX "directory_partneremails_create_by_idx" ON "directory_partneremails"("create_by");

-- AddForeignKey
ALTER TABLE "directory_partneremails" ADD CONSTRAINT "directory_partneremails_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "directory_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_partneremails" ADD CONSTRAINT "directory_partneremails_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
