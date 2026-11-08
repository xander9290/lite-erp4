-- CreateTable
CREATE TABLE "flota_records" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "plate" VARCHAR(20) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flota_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flota_records_plate_key" ON "flota_records"("plate");
