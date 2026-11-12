-- Explicit tutorial reset: remove only Flota and its history.
BEGIN;
SET LOCAL lock_timeout = '10s';

DELETE FROM "record_activities"
WHERE "model" IN ('FlotaRecord', 'FlotaFabricante', 'FlotaModelo', 'FlotaVehicle');

-- DropForeignKey
ALTER TABLE "flota_fabricante" DROP CONSTRAINT "flota_fabricante_create_by_fkey";

-- DropForeignKey
ALTER TABLE "flota_modelo" DROP CONSTRAINT "flota_modelo_create_by_fkey";

-- DropForeignKey
ALTER TABLE "flota_modelo" DROP CONSTRAINT "flota_modelo_fabricante_id_fkey";

-- DropForeignKey
ALTER TABLE "flota_records" DROP CONSTRAINT "flota_records_create_by_fkey";

-- DropForeignKey
ALTER TABLE "flota_vehicle" DROP CONSTRAINT "flota_vehicle_create_by_fkey";

-- DropForeignKey
ALTER TABLE "flota_vehicle" DROP CONSTRAINT "flota_vehicle_name_fkey";

-- DropTable
DROP TABLE "flota_fabricante";

-- DropTable
DROP TABLE "flota_modelo";

-- DropTable
DROP TABLE "flota_records";

-- DropTable
DROP TABLE "flota_vehicle";

-- DropEnum
DROP TYPE "flota_modelo_vehicle_type";

COMMIT;
