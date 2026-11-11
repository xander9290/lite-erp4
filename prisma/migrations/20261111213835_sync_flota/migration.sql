-- CreateEnum
CREATE TYPE "flota_modelo_vehicle_type" AS ENUM ('car', 'bike');

-- CreateTable
CREATE TABLE "flota_modelo" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(5) NOT NULL,
    "fabricante_id" TEXT NOT NULL,
    "vehicle_type" "flota_modelo_vehicle_type" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
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
