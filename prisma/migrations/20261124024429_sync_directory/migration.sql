-- AlterTable
ALTER TABLE "directory_partner" ADD COLUMN     "country_id" TEXT,
ADD COLUMN     "county_id" TEXT,
ADD COLUMN     "province_id" TEXT,
ADD COLUMN     "town_id" TEXT;

-- CreateIndex
CREATE INDEX "directory_partner_country_id_idx" ON "directory_partner"("country_id");

-- CreateIndex
CREATE INDEX "directory_partner_province_id_idx" ON "directory_partner"("province_id");

-- CreateIndex
CREATE INDEX "directory_partner_county_id_idx" ON "directory_partner"("county_id");

-- CreateIndex
CREATE INDEX "directory_partner_town_id_idx" ON "directory_partner"("town_id");

-- AddForeignKey
ALTER TABLE "directory_partner" ADD CONSTRAINT "directory_partner_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "ubicaciones_pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_partner" ADD CONSTRAINT "directory_partner_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "ubicaciones_estado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_partner" ADD CONSTRAINT "directory_partner_county_id_fkey" FOREIGN KEY ("county_id") REFERENCES "ubicaciones_municipio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_partner" ADD CONSTRAINT "directory_partner_town_id_fkey" FOREIGN KEY ("town_id") REFERENCES "ubicaciones_localidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
