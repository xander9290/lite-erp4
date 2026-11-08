-- CreateTable
CREATE TABLE "dental_treatments" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "performed_at" TIMESTAMPTZ(3) NOT NULL,
    "procedure" VARCHAR(1000) NOT NULL,
    "observations" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dental_treatments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dental_treatments_appointment_id_position_idx" ON "dental_treatments"("appointment_id", "position");

-- CreateIndex
CREATE INDEX "dental_treatments_performed_at_idx" ON "dental_treatments"("performed_at");

-- AddForeignKey
ALTER TABLE "dental_treatments" ADD CONSTRAINT "dental_treatments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "dental_appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
