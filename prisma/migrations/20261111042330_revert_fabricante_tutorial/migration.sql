-- Revert the local Fabricante exercise; keep its original migration history.
-- Abort rather than discard records created after the preflight check.
BEGIN;
LOCK TABLE "flota_fabricante" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "flota_fabricante") THEN
        RAISE EXCEPTION 'Fabricante tiene registros; se cancela la retirada sin borrar datos.';
    END IF;
END $$;
DROP TABLE "flota_fabricante";
COMMIT;
