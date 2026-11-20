-- A state code is unique within its country, never globally.
-- Duplicate groups were checked before preparing this migration; index creation
-- also rejects duplicates introduced concurrently, without rewriting records.
CREATE UNIQUE INDEX "ubicaciones_estado_pais_id_codigo_key" ON "ubicaciones_estado"("pais_id", "codigo");
