-- lite-erp: reviewed force migration
BEGIN;
SET LOCAL lock_timeout = '10s';
LOCK TABLE "directory_businessactivity" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "directory_core_user" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "directory_partner" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "directory_partneremails" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "directory_partnertags" IN SHARE ROW EXCLUSIVE MODE;
DO $lite_erp_force$
BEGIN
  IF EXISTS (SELECT 1 FROM "directory_partner" WHERE char_length("name") > 120 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartner.name: existen valores mayores de 120 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partner" WHERE "name" IS NULL LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartner.name: existen valores nulos. Complétalos antes de hacerlo obligatorio.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partner" WHERE char_length("emails") > 200 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartner.emails: existen valores mayores de 200 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partner" WHERE char_length("phones") > 200 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartner.phones: existen valores mayores de 200 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partner" WHERE char_length("street") > 100 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartner.street: existen valores mayores de 100 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partner" WHERE char_length("cross_streets") > 150 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartner.crossStreets: existen valores mayores de 150 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partner" WHERE char_length("street_number") > 10 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartner.streetNumber: existen valores mayores de 10 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partner" WHERE char_length("unit_number") > 10 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartner.unitNumber: existen valores mayores de 10 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partner" WHERE char_length("vat") > 13 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartner.vat: existen valores mayores de 13 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partner" WHERE char_length("curp") > 18 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartner.curp: existen valores mayores de 18 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partner" WHERE char_length("image") > 2048 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartner.image: existen valores mayores de 2048 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partner" WHERE char_length("complete_address") > 500 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartner.completeAddress: existen valores mayores de 500 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partnertags" WHERE char_length("name") > 50 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartnertags.name: existen valores mayores de 50 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partnertags" WHERE "name" IS NULL LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartnertags.name: existen valores nulos. Complétalos antes de hacerlo obligatorio.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_businessactivity" WHERE char_length("name") > 100 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryBusinessactivity.name: existen valores mayores de 100 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_businessactivity" WHERE "name" IS NULL LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryBusinessactivity.name: existen valores nulos. Complétalos antes de hacerlo obligatorio.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_businessactivity" WHERE "code" IS NOT NULL GROUP BY "code" HAVING count(*) > 1 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryBusinessactivity.code: existen valores duplicados. Corrígelos antes de añadir unique.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partneremails" WHERE char_length("name") > 120 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartneremails.name: existen valores mayores de 120 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partneremails" WHERE "name" IS NOT NULL GROUP BY "name" HAVING count(*) > 1 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartneremails.name: existen valores duplicados. Corrígelos antes de añadir unique.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partneremails" WHERE "name" IS NULL LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartneremails.name: existen valores nulos. Complétalos antes de hacerlo obligatorio.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_partneremails" WHERE "partner_id" IS NULL LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryPartneremails.partnerId: existen valores nulos. Complétalos antes de hacerlo obligatorio.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_core_user" WHERE "record_id" IS NOT NULL GROUP BY "record_id" HAVING count(*) > 1 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryCoreUser.recordId: existen valores duplicados. Corrígelos antes de añadir unique.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_core_user" WHERE "record_id" IS NULL LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryCoreUser.recordId: existen valores nulos. Complétalos antes de hacerlo obligatorio.'; END IF;
  IF EXISTS (SELECT 1 FROM "directory_core_user" WHERE "partner_id" IS NOT NULL GROUP BY "partner_id" HAVING count(*) > 1 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'DirectoryCoreUser.partnerId: existen valores duplicados. Corrígelos antes de añadir unique.'; END IF;
END;
$lite_erp_force$;
-- Review only. Not an applied migration.
-- AlterTable
ALTER TABLE "directory_partneremails" ALTER COLUMN "partner_id" SET NOT NULL;
COMMIT;
