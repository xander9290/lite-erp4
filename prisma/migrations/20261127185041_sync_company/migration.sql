-- CreateTable
CREATE TABLE "company_company" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(5) NOT NULL,
    "street" VARCHAR(150),
    "street_number" VARCHAR(10),
    "unit_number" VARCHAR(10),
    "zip_number" TEXT,
    "vat" VARCHAR(13),
    "email" VARCHAR(200),
    "phone" VARCHAR(200),
    "country_id" TEXT,
    "province_id" TEXT,
    "county_id" TEXT,
    "town_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "create_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_company_name_key" ON "company_company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "company_company_code_key" ON "company_company"("code");

-- CreateIndex
CREATE INDEX "company_company_country_id_idx" ON "company_company"("country_id");

-- CreateIndex
CREATE INDEX "company_company_province_id_idx" ON "company_company"("province_id");

-- CreateIndex
CREATE INDEX "company_company_county_id_idx" ON "company_company"("county_id");

-- CreateIndex
CREATE INDEX "company_company_town_id_idx" ON "company_company"("town_id");

-- CreateIndex
CREATE INDEX "company_company_create_by_idx" ON "company_company"("create_by");

-- CreateIndex
CREATE UNIQUE INDEX "company_company_code_name_key" ON "company_company"("code", "name");

-- AddForeignKey
ALTER TABLE "company_company" ADD CONSTRAINT "company_company_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "ubicaciones_pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_company" ADD CONSTRAINT "company_company_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "ubicaciones_estado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_company" ADD CONSTRAINT "company_company_county_id_fkey" FOREIGN KEY ("county_id") REFERENCES "ubicaciones_municipio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_company" ADD CONSTRAINT "company_company_town_id_fkey" FOREIGN KEY ("town_id") REFERENCES "ubicaciones_localidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_company" ADD CONSTRAINT "company_company_create_by_fkey" FOREIGN KEY ("create_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
