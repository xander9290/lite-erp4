-- CreateEnum
CREATE TYPE "dental_appointment_status" AS ENUM ('SCHEDULED', 'ATTENDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "dental_appointments" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "observations" TEXT,
    "status" "dental_appointment_status" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dental_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dental_appointments_scheduled_at_idx" ON "dental_appointments"("scheduled_at");

-- CreateIndex
CREATE INDEX "dental_appointments_status_scheduled_at_idx" ON "dental_appointments"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "dental_appointments_patient_id_scheduled_at_idx" ON "dental_appointments"("patient_id", "scheduled_at");

-- AddForeignKey
ALTER TABLE "dental_appointments" ADD CONSTRAINT "dental_appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
