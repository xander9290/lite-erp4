import assert from "node:assert/strict";
import test from "node:test";
import { treatmentCreateData, treatmentFormValues, treatmentHistoryValues, treatmentUpdateData } from "./treatment";
import { treatmentSchema } from "../schemas/treatment.schema";
import { DentalAppointmentStatus } from "@/generated/prisma/enums";

const line = treatmentSchema.parse({ performedAt: "2026-11-06T15:30:00.000Z", procedure: "Limpieza", observations: "" });

test("line writes whitelist fields and plan ordered creates, updates and deletions", () => {
  assert.deepEqual(treatmentCreateData([line]).create, [{ performedAt: new Date(line.performedAt), procedure: "Limpieza", observations: null, position: 0 }]);
  const plan = treatmentUpdateData([{ id: "kept" }, { id: "removed" }], [line, { ...line, id: "kept", procedure: "Revisión" }]);
  assert.equal(plan.create[0].position, 0);
  assert.deepEqual(plan.update[0].where, { id: "kept" });
  assert.equal(plan.update[0].data.position, 1);
  assert.equal(plan.update[0].data.procedure, "Revisión");
  assert.deepEqual(plan.deleteMany, { id: { in: ["removed"] } });
  assert.equal(JSON.stringify(plan).includes("appointmentId"), false);
  assert.throws(() => treatmentUpdateData([{ id: "kept" }], [{ ...line, id: "foreign" }]), /no pertenece/);
  assert.throws(() => treatmentUpdateData([{ id: "kept" }], [{ ...line, id: "kept" }, { ...line, id: "kept" }]), /más de una/);
  assert.throws(() => treatmentCreateData([{ ...line, id: "existing" }]), /tratamientos nuevos/);
});

test("clinical DTOs serialize UTC dates and expose only their selected fields", () => {
  const record = {
    id: "treatment-id", performedAt: new Date(line.performedAt), procedure: line.procedure, observations: null,
    appointmentId: "appointment-id", position: 10,
    appointment: { id: "appointment-id", scheduledAt: new Date(line.performedAt), reason: "Consulta", status: DentalAppointmentStatus.ATTENDED, patient: { user: { password: "private-hash" } } },
  };
  assert.deepEqual(treatmentFormValues(record), { id: record.id, ...line });
  const history = treatmentHistoryValues(record);
  assert.equal(history.appointment.id, record.appointmentId);
  assert.equal(history.performedAt, line.performedAt);
  assert.equal(history.appointment.scheduledAt, line.performedAt);
  assert.deepEqual(JSON.parse(JSON.stringify(history)), history);
  assert.equal(JSON.stringify(history).includes("private-hash"), false);
  assert.equal(Object.hasOwn(history, "position"), false);
});
