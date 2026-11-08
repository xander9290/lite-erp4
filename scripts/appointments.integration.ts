import assert from "node:assert/strict";
import { config } from "dotenv";
import { appointmentCreateData, appointmentFormSelect, appointmentFormValues, appointmentUpdateData } from "../src/app/(auth)/erp/citas/models/appointment";
import { treatmentHistoryOrder, treatmentHistorySelect, treatmentHistoryValues } from "../src/app/(auth)/erp/citas/models/treatment";
import { appointmentSchema, newAppointmentDefaults } from "../src/app/(auth)/erp/citas/schemas/appointment.schema";
import { contactFormSelect, contactFormValues } from "../src/app/(auth)/erp/contactos/models/partner";
import { createPrismaClient } from "../src/lib/prisma-client";

config({ path: ".env.local", quiet: true }); config({ quiet: true });
const { prisma } = await import("../src/lib/prisma");
let patientId: string | undefined;
let appointmentId: string | undefined;
let secondAppointmentId: string | undefined;
let alternateClient: ReturnType<typeof createPrismaClient> | undefined;

try {
  const patient = await prisma.partner.create({ data: { name: "Paciente temporal de integración", email: "test@example.test", phone: "+52 555 0100" } });
  patientId = patient.id;
  const input = appointmentSchema.parse({ ...newAppointmentDefaults,
    patientId, reason: "Motivo temporal de integración", scheduledAt: "2026-11-06T15:00:00.000Z", observations: "Observación temporal de integración",
  });
  const appointment = await prisma.dentalAppointment.create({ data: appointmentCreateData(input), select: appointmentFormSelect });
  appointmentId = appointment.id;
  const values = appointmentFormValues(appointment);
  assert.equal(values.patientId, patientId);
  assert.equal(values.scheduledAt, input.scheduledAt);
  assert.equal(values.status, "SCHEDULED");
  assert.equal(appointmentSchema.safeParse(values).success, true);

  const related = await prisma.partner.findUniqueOrThrow({ where: { id: patientId }, select: { dentalAppointments: { select: { id: true } } } });
  assert.deepEqual(related.dentalAppointments, [{ id: appointmentId }]);
  const alternateUrl = new URL(process.env.DATABASE_URL!);
  alternateUrl.searchParams.set("options", "-c timezone=Pacific/Auckland");
  alternateClient = createPrismaClient(alternateUrl.toString());
  const zone = await alternateClient.$queryRaw<Array<{ zone: string }>>`SELECT current_setting('TimeZone') AS zone`;
  assert.equal(zone[0].zone, "UTC");
  const inAnotherDatabaseZone = await alternateClient.dentalAppointment.findUniqueOrThrow({ where: { id: appointmentId }, select: appointmentFormSelect });
  assert.equal(inAnotherDatabaseZone.scheduledAt.toISOString(), input.scheduledAt);
  const epoch = await alternateClient.$queryRaw<Array<{ epoch: string }>>`SELECT extract(epoch FROM scheduled_at)::text AS epoch FROM dental_appointments WHERE id = ${appointmentId}`;
  assert.equal(Number(epoch[0].epoch) * 1000, Date.parse(input.scheduledAt!));

  await assert.rejects(prisma.partner.delete({ where: { id: patientId } }), error => typeof error === "object" && error !== null && "code" in error && error.code === "P2003");
  assert.equal(await prisma.partner.count({ where: { id: patientId } }), 1);
  const count = await prisma.dentalAppointment.count();
  await assert.rejects(prisma.dentalAppointment.create({ data: appointmentCreateData({ ...input, patientId: "missing-patient" }) }));
  assert.equal(await prisma.dentalAppointment.count(), count);

  const contact = contactFormValues(await prisma.partner.findUniqueOrThrow({ where: { id: patientId }, select: contactFormSelect }));
  assert.equal(Object.hasOwn(contact, "dentalAppointments"), false);
  assert.equal(JSON.stringify(contact).includes(input.reason), false);

  // A second visit supplies another line to test patient history and foreign-ID rejection.
  const treatment = { performedAt: "2026-11-07T16:00:00.000Z", procedure: "Limpieza temporal", observations: "" };
  const second = await prisma.dentalAppointment.create({
    data: appointmentCreateData(appointmentSchema.parse({ ...input, scheduledAt: treatment.performedAt, treatments: [treatment] })),
    select: appointmentFormSelect,
  });
  secondAppointmentId = second.id;
  assert.equal(second.treatments.length, 1);
  assert.equal(second.treatments[0].performedAt.toISOString(), treatment.performedAt);
  assert.ok(second.treatments[0].id);

  const saved = await prisma.$transaction(async tx => {
    const current = await tx.dentalAppointment.findUniqueOrThrow({ where: { id: appointmentId }, select: appointmentFormSelect });
    const edit = appointmentSchema.parse({ ...appointmentFormValues(current), treatments: [
      { ...treatment, performedAt: "2026-11-06T15:30:00.000Z", procedure: "Revisión temporal" },
      { ...treatment, performedAt: "2026-11-06T16:00:00.000Z", procedure: "Ajuste temporal" },
    ] });
    return tx.dentalAppointment.update({ where: { id: current.id, updatedAt: new Date(edit.revision) }, data: appointmentUpdateData(edit, current.treatments), select: appointmentFormSelect });
  }, { isolationLevel: "Serializable" });
  const [first, removed] = saved.treatments;
  const edited = appointmentSchema.parse({ ...appointmentFormValues(saved), treatments: [
    { ...treatment, procedure: "Alta temporal" },
    { ...appointmentFormValues(saved).treatments[0], procedure: "Revisión actualizada" },
  ] });
  const updated = await prisma.dentalAppointment.update({ where: { id: saved.id, updatedAt: new Date(edited.revision) }, data: appointmentUpdateData(edited, saved.treatments), select: appointmentFormSelect });
  assert.deepEqual(updated.treatments.map(row => row.procedure), ["Alta temporal", "Revisión actualizada"]);
  assert.equal(updated.treatments[1].id, first.id);
  assert.equal(await prisma.dentalTreatment.count({ where: { id: removed.id } }), 0);
  assert.equal(await prisma.dentalTreatment.count({ where: { appointmentId: second.id } }), 1);

  // Missing/foreign IDs are rejected before writing, including a proposed parent change.
  const foreignEdit = appointmentSchema.parse({ ...appointmentFormValues(updated), reason: "Must not persist", treatments: [{ ...treatment, id: second.treatments[0].id }] });
  assert.throws(() => appointmentUpdateData(foreignEdit, updated.treatments), /no pertenece/);
  // Nested writes also enforce relation ownership if the server were to pass a wrong owned collection.
  await assert.rejects(prisma.dentalAppointment.update({ where: { id: updated.id }, data: appointmentUpdateData(foreignEdit, second.treatments) }));
  const unchanged = await prisma.dentalAppointment.findUniqueOrThrow({ where: { id: updated.id }, select: appointmentFormSelect });
  assert.deepEqual(unchanged, updated);
  await assert.rejects(prisma.dentalAppointment.delete({ where: { id: updated.id } }), error => typeof error === "object" && error !== null && "code" in error && error.code === "P2003");

  const history = (await prisma.dentalTreatment.findMany({
    where: { appointment: { patientId } }, select: treatmentHistorySelect, orderBy: treatmentHistoryOrder,
  })).map(treatmentHistoryValues);
  assert.equal(history.length, 3);
  assert.deepEqual(new Set(history.map(row => row.appointment.id)), new Set([updated.id, second.id]));
  assert.ok(history.every((row, index) => index === 0 || row.performedAt! <= history[index - 1].performedAt!));
  assert.equal(await prisma.dentalTreatment.count({ where: { appointment: { patientId: "missing-patient" } } }), 0);
  // Empty is an intentional complete collection; only this appointment's lines are removed.
  await prisma.dentalAppointment.update({ where: { id: updated.id }, data: appointmentUpdateData(appointmentSchema.parse({ ...appointmentFormValues(updated), treatments: [] }), updated.treatments) });
  assert.equal(await prisma.dentalTreatment.count({ where: { appointmentId: updated.id } }), 0);
  assert.equal(await prisma.dentalTreatment.count({ where: { appointmentId: second.id } }), 1);
  console.log("Appointments integration passed: UTC, contact separation, nested treatment CRUD/order, ownership rollback, restricted deletion and patient history.");
} finally {
  const appointmentIds = [appointmentId, secondAppointmentId].filter((id): id is string => Boolean(id));
  await prisma.dentalTreatment.deleteMany({ where: { appointmentId: { in: appointmentIds } } });
  if (secondAppointmentId) await prisma.dentalAppointment.deleteMany({ where: { id: secondAppointmentId } });
  if (appointmentId) await prisma.dentalAppointment.deleteMany({ where: { id: appointmentId } });
  if (patientId) await prisma.partner.deleteMany({ where: { id: patientId } });
  await alternateClient?.$disconnect();
  await prisma.$disconnect();
}
