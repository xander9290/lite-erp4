-- lite-erp: unique indexes prepared by orm:sync (Prisma cannot answer its duplicate warning without a terminal).
-- Checked before preparing: no duplicate complete groups in ubicaciones_municipio(estado_id, codigo).
-- CreateIndex
CREATE UNIQUE INDEX "ubicaciones_municipio_estado_id_codigo_key" ON "ubicaciones_municipio"("estado_id", "codigo");
