-- CreateTable
CREATE TABLE "flota_vehicle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flota_vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flota_vehicle_name_idx" ON "flota_vehicle"("name");

-- CreateIndex
CREATE INDEX "flota_vehicle_create_by_idx" ON "flota_vehicle"("create_by");

-- AddForeignKey
ALTER TABLE "flota_vehicle" ADD CONSTRAINT "flota_vehicle_name_fkey" FOREIGN KEY ("name") REFERENCES "flota_modelo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flota_vehicle" ADD CONSTRAINT "flota_vehicle_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
