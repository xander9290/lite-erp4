-- CreateTable
CREATE TABLE "ubicaciones_localidad" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "municipio_id" TEXT NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ubicaciones_localidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ubicaciones_localidad_municipio_id_idx" ON "ubicaciones_localidad"("municipio_id");

-- CreateIndex
CREATE INDEX "ubicaciones_localidad_create_by_idx" ON "ubicaciones_localidad"("create_by");

-- AddForeignKey
ALTER TABLE "ubicaciones_localidad" ADD CONSTRAINT "ubicaciones_localidad_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "ubicaciones_municipio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicaciones_localidad" ADD CONSTRAINT "ubicaciones_localidad_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
