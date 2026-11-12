-- CreateTable
CREATE TABLE "flota_modelo" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "fabricante_id" TEXT NOT NULL,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flota_modelo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flota_modelo_fabricante_id_idx" ON "flota_modelo"("fabricante_id");

-- CreateIndex
CREATE INDEX "flota_modelo_create_by_idx" ON "flota_modelo"("create_by");

-- AddForeignKey
ALTER TABLE "flota_modelo" ADD CONSTRAINT "flota_modelo_fabricante_id_fkey" FOREIGN KEY ("fabricante_id") REFERENCES "flota_fabricante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flota_modelo" ADD CONSTRAINT "flota_modelo_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
