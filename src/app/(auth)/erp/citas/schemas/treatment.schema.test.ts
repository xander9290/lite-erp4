import assert from "node:assert/strict";
import test from "node:test";
import { appointmentSchema, newAppointmentDefaults } from "./appointment.schema";
import { createTreatment, treatmentSchema } from "./treatment.schema";

const line = { performedAt: "2026-11-06T15:30:00.000Z", procedure: " Limpieza dental ", observations: " Sin molestias " };
const appointment = { ...newAppointmentDefaults, patientId: "patient-id", reason: "Consulta", scheduledAt: line.performedAt };

test("treatment lines require procedure and explicit UTC date; notes are optional", () => {
  assert.equal(treatmentSchema.safeParse(createTreatment()).success, false);
  assert.notEqual(createTreatment(), createTreatment());
  assert.deepEqual(treatmentSchema.parse(line), { ...line, procedure: "Limpieza dental", observations: "Sin molestias" });
  assert.equal(treatmentSchema.safeParse({ ...line, observations: "" }).success, true);
  assert.equal(treatmentSchema.safeParse({ ...line, performedAt: "2020-01-01T15:00:00.000Z" }).success, true);
  for (const patch of [
    { performedAt: null }, { performedAt: "2026-02-30T15:00:00.000Z" }, { performedAt: "2026-11-06T09:30" },
    { performedAt: "2026-11-06T09:30:00-06:00" }, { procedure: " " }, { procedure: "x".repeat(1001) },
    { observations: "x".repeat(10001) }, { id: " " }, { appointmentId: "another-appointment" },
    { patientId: "another-patient" }, { position: 20 }, { appointment: { connect: { id: "another" } } },
  ]) assert.equal(treatmentSchema.safeParse({ ...line, ...patch }).success, false);
});

test("appointments accept complete treatment collections and reject duplicate or transplanted IDs", () => {
  assert.equal(appointmentSchema.safeParse({ ...appointment, treatments: [] }).success, true);
  assert.equal(appointmentSchema.safeParse({ ...appointment, treatments: [line] }).success, true);
  assert.equal(appointmentSchema.safeParse({ ...appointment, treatments: [{ ...line, id: "existing" }] }).success, false);
  const editing = { ...appointment, id: "appointment-id", revision: line.performedAt };
  assert.equal(appointmentSchema.safeParse({ ...editing, treatments: [{ ...line, id: "existing" }, line] }).success, true);
  const duplicate = appointmentSchema.safeParse({ ...editing, treatments: [{ ...line, id: "same" }, { ...line, id: "same" }] });
  assert.equal(duplicate.success, false);
  if (!duplicate.success) assert.deepEqual(duplicate.error.issues[0].path, ["treatments", 1, "id"]);
  assert.equal(appointmentSchema.safeParse({ ...appointment, treatments: Array.from({ length: 101 }, () => line) }).success, false);
  assert.equal(appointmentSchema.safeParse({ ...editing, treatments: undefined }).success, false);
});
