-- Explicit retirement approved 2026-11-13: remove Citas odontológicas and Flota, their tables and history.
-- All six tables were empty when reviewed; only Flota history rows are deleted from record_activities.
BEGIN;
SET LOCAL lock_timeout = '10s';

DELETE FROM "record_activities"
WHERE "model" IN ('FlotaRecord', 'FlotaFabricante', 'FlotaModelo', 'FlotaVehicle', 'DentalAppointment', 'DentalTreatment');

-- DropForeignKey
ALTER TABLE "dental_appointments" DROP CONSTRAINT "dental_appointments_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "dental_treatments" DROP CONSTRAINT "dental_treatments_appointment_id_fkey";

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
DROP TABLE "dental_appointments";

-- DropTable
DROP TABLE "dental_treatments";

-- DropTable
DROP TABLE "flota_fabricante";

-- DropTable
DROP TABLE "flota_modelo";

-- DropTable
DROP TABLE "flota_records";

-- DropTable
DROP TABLE "flota_vehicle";

-- DropEnum
DROP TYPE "dental_appointment_status";


COMMIT;
