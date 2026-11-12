-- lite-erp: reviewed force migration
BEGIN;
SET LOCAL lock_timeout = '10s';
LOCK TABLE "flota_fabricante" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "flota_modelo" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "flota_records" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "flota_vehicle" IN SHARE ROW EXCLUSIVE MODE;
DO $lite_erp_force$
BEGIN
  IF EXISTS (SELECT 1 FROM "flota_records" WHERE char_length("name") > 120 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'FlotaRecord.name: existen valores mayores de 120 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "flota_records" WHERE "name" IS NULL LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'FlotaRecord.name: existen valores nulos. Complétalos antes de hacerlo obligatorio.'; END IF;
  IF EXISTS (SELECT 1 FROM "flota_records" WHERE char_length("plate") > 20 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'FlotaRecord.plate: existen valores mayores de 20 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "flota_records" WHERE "plate" IS NOT NULL GROUP BY "plate" HAVING count(*) > 1 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'FlotaRecord.plate: existen valores duplicados. Corrígelos antes de añadir unique.'; END IF;
  IF EXISTS (SELECT 1 FROM "flota_records" WHERE "plate" IS NULL LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'FlotaRecord.plate: existen valores nulos. Complétalos antes de hacerlo obligatorio.'; END IF;
  IF EXISTS (SELECT 1 FROM "flota_records" WHERE char_length("brand") > 80 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'FlotaRecord.brand: existen valores mayores de 80 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "flota_fabricante" WHERE char_length("name") > 120 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'FlotaFabricante.name: existen valores mayores de 120 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "flota_fabricante" WHERE "name" IS NULL LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'FlotaFabricante.name: existen valores nulos. Complétalos antes de hacerlo obligatorio.'; END IF;
  IF EXISTS (SELECT 1 FROM "flota_fabricante" WHERE char_length("avatar") > 2048 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'FlotaFabricante.avatar: existen valores mayores de 2048 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "flota_modelo" WHERE char_length("name") > 120 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'FlotaModelo.name: existen valores mayores de 120 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "flota_modelo" WHERE "name" IS NULL LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'FlotaModelo.name: existen valores nulos. Complétalos antes de hacerlo obligatorio.'; END IF;
  IF EXISTS (SELECT 1 FROM "flota_vehicle" WHERE "name" IS NULL LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'FlotaVehicle.name: existen valores nulos. Complétalos antes de hacerlo obligatorio.'; END IF;
  IF EXISTS (SELECT 1 FROM "flota_vehicle" WHERE char_length("plate") > 20 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'FlotaVehicle.plate: existen valores mayores de 20 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "flota_vehicle" WHERE "plate" IS NOT NULL GROUP BY "plate" HAVING count(*) > 1 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'FlotaVehicle.plate: existen valores duplicados. Corrígelos antes de añadir unique.'; END IF;
END;
$lite_erp_force$;
-- Review only. Not an applied migration.
-- AlterTable
ALTER TABLE "flota_vehicle" ALTER COLUMN "plate" SET DATA TYPE VARCHAR(20);

-- CreateIndex
CREATE UNIQUE INDEX "flota_vehicle_plate_key" ON "flota_vehicle"("plate");
COMMIT;
