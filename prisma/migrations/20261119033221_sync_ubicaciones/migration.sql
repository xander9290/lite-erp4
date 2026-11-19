-- CreateTable
CREATE TABLE "ubicaciones_estado" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "pais_id" TEXT NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ubicaciones_estado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ubicaciones_estado_pais_id_idx" ON "ubicaciones_estado"("pais_id");

-- CreateIndex
CREATE INDEX "ubicaciones_estado_create_by_idx" ON "ubicaciones_estado"("create_by");

-- AddForeignKey
ALTER TABLE "ubicaciones_estado" ADD CONSTRAINT "ubicaciones_estado_pais_id_fkey" FOREIGN KEY ("pais_id") REFERENCES "ubicaciones_pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicaciones_estado" ADD CONSTRAINT "ubicaciones_estado_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
