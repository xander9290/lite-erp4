-- lite-erp: reviewed force migration
BEGIN;
SET LOCAL lock_timeout = '10s';
LOCK TABLE "company_company" IN SHARE ROW EXCLUSIVE MODE;
DO $lite_erp_force$
BEGIN
  IF EXISTS (SELECT 1 FROM "company_company" WHERE char_length("code") > 5 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'CompanyCompany.code: existen valores mayores de 5 caracteres. Corrígelos antes de sincronizar; no se truncarán.'; END IF;
  IF EXISTS (SELECT 1 FROM "company_company" WHERE "code" IS NOT NULL GROUP BY "code" HAVING count(*) > 1 LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'CompanyCompany.code: existen valores duplicados. Corrígelos antes de añadir unique.'; END IF;
  IF EXISTS (SELECT 1 FROM "company_company" WHERE "code" IS NULL LIMIT 1) THEN RAISE EXCEPTION USING MESSAGE = 'CompanyCompany.code: existen valores nulos. Complétalos antes de hacerlo obligatorio.'; END IF;
END;
$lite_erp_force$;
-- Review only. Not an applied migration.
-- DropIndex
DROP INDEX "company_company_name_key";

-- DropIndex
DROP INDEX "company_company_code_name_key";
COMMIT;
