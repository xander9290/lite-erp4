import assert from "node:assert/strict";
import test from "node:test";
import { appointmentSchema, appointmentStatusOptions, newAppointmentDefaults } from "./appointment.schema";
import { dentalClinicTimeZone } from "../settings";

const revision = "2026-11-06T03:00:00.000Z";
const valid = { ...newAppointmentDefaults, patientId: "patient-id", reason: "Consulta de prueba", scheduledAt: "2026-11-06T15:00:00.000Z" };

test("new appointments start scheduled and require patient, reason and date/time", () => {
  assert.equal(Object.hasOwn(newAppointmentDefaults, "id"), false);
  assert.equal(newAppointmentDefaults.status, "SCHEDULED");
  assert.equal(newAppointmentDefaults.patientId, null);
  assert.equal(newAppointmentDefaults.scheduledAt, null);
  const result = appointmentSchema.safeParse(newAppointmentDefaults);
  assert.equal(result.success, false);
  if (!result.success) assert.deepEqual(new Set(result.error.issues.map(issue => issue.path[0])), new Set(["patientId", "reason", "scheduledAt"]));
  assert.equal(appointmentSchema.safeParse(valid).success, true);
});

test("appointments normalize text and accept only explicit UTC instants", () => {
  const values = appointmentSchema.parse({ ...valid, reason: "  Consulta de prueba  ", observations: "  Observación de prueba  " });
  assert.equal(values.reason, "Consulta de prueba");
  assert.equal(values.observations, "Observación de prueba");
  for (const scheduledAt of [null, "", "2026-11-06", "2026-11-06T09:00", "2026-11-06T09:00:00-06:00", "2026-02-30T15:00:00.000Z"]) {
    assert.equal(appointmentSchema.safeParse({ ...valid, scheduledAt }).success, false);
  }
  // Historical appointments can be recorded without changing their actual date.
  assert.equal(appointmentSchema.safeParse({ ...valid, scheduledAt: "2020-01-01T15:00:00.000Z" }).success, true);
  assert.doesNotThrow(() => new Intl.DateTimeFormat("es-MX", { timeZone: dentalClinicTimeZone }));
});

test("statuses match the database and editing requires the loaded revision", () => {
  assert.deepEqual(appointmentStatusOptions.map(option => option.value), ["SCHEDULED", "ATTENDED", "CANCELLED"]);
  for (const { value: status } of appointmentStatusOptions) assert.equal(appointmentSchema.safeParse({ ...valid, status }).success, true);
  assert.equal(appointmentSchema.safeParse({ ...valid, status: "scheduled" }).success, false);
  assert.equal(appointmentSchema.safeParse({ ...valid, revision }).success, false);
  assert.equal(appointmentSchema.safeParse({ ...valid, id: "appointment-id", revision: "" }).success, false);
  assert.equal(appointmentSchema.safeParse({ ...valid, id: "appointment-id", revision }).success, true);
});

test("the appointment contract rejects excess fields, credentials and nested patient edits", () => {
  for (const patch of [
    { reason: " " }, { reason: "x".repeat(1001) }, { observations: "x".repeat(10001) },
    { patientId: " " }, { patientId: "x".repeat(101) }, { patientId: { id: "another-patient" } },
    { patient: { update: { name: "Injected" } } }, { isAdmin: true }, { createdAt: revision }, { updatedAt: revision }, { password: "anything" },
  ]) assert.equal(appointmentSchema.safeParse({ ...valid, ...patch }).success, false);
});
