-- CreateTable
CREATE TABLE "flota_fabricante" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flota_fabricante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flota_fabricante_create_by_idx" ON "flota_fabricante"("create_by");

-- AddForeignKey
ALTER TABLE "flota_fabricante" ADD CONSTRAINT "flota_fabricante_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
