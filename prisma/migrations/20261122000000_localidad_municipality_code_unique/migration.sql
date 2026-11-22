-- Localidad is identified by its municipality and business code, not by a global code.
CREATE UNIQUE INDEX "ubicaciones_localidad_municipio_id_codigo_key" ON "ubicaciones_localidad"("municipio_id", "codigo");
