import assert from "node:assert/strict";
import test from "node:test";
import { DentalAppointmentStatus } from "@/generated/prisma/enums";
import { appointmentFormValues, appointmentCreateData, appointmentUpdateData } from "./appointment";
import { appointmentSchema } from "../schemas/appointment.schema";

test("appointment DTOs preserve UTC instants and omit unrelated patient/account data", () => {
  const record = {
    id: "appointment-id", patientId: "patient-id", reason: "Consulta de prueba",
    scheduledAt: new Date("2026-11-06T15:00:00.000Z"), observations: null,
    status: DentalAppointmentStatus.SCHEDULED, updatedAt: new Date("2026-11-06T03:00:00.000Z"),
    treatments: [],
    patient: { name: "Paciente de prueba", user: { password: "private-hash" } },
  };
  const values = appointmentFormValues(record);
  assert.equal(values.scheduledAt, "2026-11-06T15:00:00.000Z");
  assert.equal(values.observations, "");
  assert.equal(appointmentSchema.safeParse(values).success, true);
  assert.deepEqual(JSON.parse(JSON.stringify(values)), values);
  assert.equal(JSON.stringify(values).includes("private-hash"), false);
  assert.equal(Object.hasOwn(values, "patient"), false);
  const data = appointmentUpdateData(appointmentSchema.parse(values), record.treatments);
  assert.deepEqual(data, { patient: { connect: { id: record.patientId } }, reason: record.reason, scheduledAt: record.scheduledAt, observations: null, status: record.status, treatments: { create: [], update: [], deleteMany: { id: { in: [] } } } });
  assert.equal(Object.hasOwn(data, "id"), false);
  assert.equal(Object.hasOwn(data, "revision"), false);
  assert.equal(Object.hasOwn(data, "updatedAt"), false);
  assert.throws(() => appointmentCreateData(appointmentSchema.parse(values)), /ID ni revisión/);
});
