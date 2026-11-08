-- Review only. Not an applied migration.
-- CreateEnum
CREATE TYPE "fleet_vehicles_state" AS ENUM ('available', 'maintenance');

-- CreateTable
CREATE TABLE "fleet_vehicles" (
    "id" TEXT NOT NULL,
    "plate" VARCHAR(20) NOT NULL,
    "brand" VARCHAR(100) NOT NULL,
    "mileage" INTEGER NOT NULL DEFAULT 0,
    "driver_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "state" "fleet_vehicles_state" NOT NULL DEFAULT 'available',
    "next_service_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fleet_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fleet_vehicles_plate_key" ON "fleet_vehicles"("plate");

-- CreateIndex
CREATE INDEX "fleet_vehicles_driver_id_idx" ON "fleet_vehicles"("driver_id");

-- AddForeignKey
ALTER TABLE "fleet_vehicles" ADD CONSTRAINT "fleet_vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

