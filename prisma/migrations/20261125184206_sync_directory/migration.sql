-- CreateTable
CREATE TABLE "directory_core_user" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "partner_id" TEXT,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "directory_core_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "directory_core_user_record_id_key" ON "directory_core_user"("record_id");

-- CreateIndex
CREATE UNIQUE INDEX "directory_core_user_partner_id_key" ON "directory_core_user"("partner_id");

-- CreateIndex
CREATE INDEX "directory_core_user_create_by_idx" ON "directory_core_user"("create_by");

-- AddForeignKey
ALTER TABLE "directory_core_user" ADD CONSTRAINT "directory_core_user_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_core_user" ADD CONSTRAINT "directory_core_user_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "directory_partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_core_user" ADD CONSTRAINT "directory_core_user_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
