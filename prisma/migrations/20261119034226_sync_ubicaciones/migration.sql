-- CreateTable
CREATE TABLE "ubicaciones_municipio" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "estado_id" TEXT NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ubicaciones_municipio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ubicaciones_municipio_estado_id_idx" ON "ubicaciones_municipio"("estado_id");

-- CreateIndex
CREATE INDEX "ubicaciones_municipio_create_by_idx" ON "ubicaciones_municipio"("create_by");

-- AddForeignKey
ALTER TABLE "ubicaciones_municipio" ADD CONSTRAINT "ubicaciones_municipio_estado_id_fkey" FOREIGN KEY ("estado_id") REFERENCES "ubicaciones_estado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicaciones_municipio" ADD CONSTRAINT "ubicaciones_municipio_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
