-- CreateTable
CREATE TABLE "ubicaciones_pais" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "codigo" VARCHAR(2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ubicaciones_pais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ubicaciones_pais_codigo_key" ON "ubicaciones_pais"("codigo");

-- CreateIndex
CREATE INDEX "ubicaciones_pais_create_by_idx" ON "ubicaciones_pais"("create_by");

-- AddForeignKey
ALTER TABLE "ubicaciones_pais" ADD CONSTRAINT "ubicaciones_pais_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
