-- CreateTable
CREATE TABLE "flota_vehicle" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(300),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "plate" VARCHAR(20) NOT NULL,
    "modelo_id" TEXT NOT NULL,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flota_vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flota_vehicle_plate_key" ON "flota_vehicle"("plate");

-- CreateIndex
CREATE INDEX "flota_vehicle_modelo_id_idx" ON "flota_vehicle"("modelo_id");

-- CreateIndex
CREATE INDEX "flota_vehicle_create_by_idx" ON "flota_vehicle"("create_by");

-- AddForeignKey
ALTER TABLE "flota_vehicle" ADD CONSTRAINT "flota_vehicle_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "flota_modelo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flota_vehicle" ADD CONSTRAINT "flota_vehicle_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
