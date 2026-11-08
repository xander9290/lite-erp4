import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { hashPassword } from "../src/lib/auth/password";
import { readAppointmentRecord, readPatientHistoryRecord, saveAppointmentRecord } from "../src/app/(auth)/erp/citas/models/appointment.service";
import { newAppointmentDefaults } from "../src/app/(auth)/erp/citas/schemas/appointment.schema";
import { listAppointmentRecords } from "../src/app/(auth)/erp/citas/models/appointment.list";
import { appointmentListConfig } from "../src/app/(auth)/erp/citas/list.config";
import type { FormViewResult } from "../src/components/ui/form/formView.types";

config({ path: ".env.local", quiet: true }); config({ quiet: true });
const { prisma } = await import("../src/lib/prisma");
const userIds: string[] = [], partnerIds: string[] = [], appointmentIds: string[] = [];

function successful<T extends Record<string, unknown>>(result: FormViewResult<T>) {
  assert.ok(result.ok, result.ok ? undefined : result.error);
  return result.values;
}

try {
  const password = await hashPassword(randomUUID());
  for (const isAdmin of [true, false]) {
    const account = await prisma.user.create({ data: { login: `appointments_test_${randomUUID().replaceAll("-", "")}`, password, isAdmin } });
    userIds.push(account.id);
  }
  const actor = { id: userIds[0], sessionVersion: 0 };
  const reader = { id: userIds[1], sessionVersion: 0, isAdmin: true }; // Forged claim must have no effect.
  for (const name of ["Paciente temporal A", "Paciente temporal B"]) {
    const patient = await prisma.partner.create({ data: { name: `${name} ${randomUUID()}` } });
    partnerIds.push(patient.id);
  }
  const base = { ...newAppointmentDefaults, patientId: partnerIds[0], reason: "  Consulta temporal  ", scheduledAt: "2026-11-06T15:00:00.000Z" };
  const line = { performedAt: "2026-11-06T15:30:00.000Z", procedure: "Limpieza temporal", observations: "" };
  const initial = successful(await saveAppointmentRecord(prisma, actor, base));
  appointmentIds.push(initial.id!);
  assert.equal(initial.reason, "Consulta temporal");
  assert.equal(initial.status, "SCHEDULED");
  assert.deepEqual(initial.treatments, []);
  assert.deepEqual(successful(await readAppointmentRecord(prisma, actor, initial.id)), initial);
  assert.deepEqual(JSON.parse(JSON.stringify(initial)), initial);

  const emptyHistory = successful(await readPatientHistoryRecord(prisma, actor, { patientId: partnerIds[0] }));
  assert.equal(emptyHistory.total, 0);
  assert.deepEqual(emptyHistory.rows, []);
  assert.equal(emptyHistory.pageCount, 1);

  for (const badId of [undefined, "", " ", "x".repeat(101), { id: initial.id }]) assert.equal((await readAppointmentRecord(prisma, actor, badId)).ok, false);
  assert.equal((await readAppointmentRecord(prisma, actor, "missing-appointment")).ok, false);
  const invalid = await saveAppointmentRecord(prisma, actor, { ...base, treatments: [{ ...line, procedure: "" }] });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) { assert.equal(invalid.kind, "validation"); assert.ok(invalid.fieldErrors?.["treatments.0.procedure"]); }
  const missingPatient = await saveAppointmentRecord(prisma, actor, { ...base, patientId: "missing-patient" });
  assert.equal(missingPatient.ok, false);
  if (!missingPatient.ok) assert.ok(missingPatient.fieldErrors?.patientId);
  assert.equal((await saveAppointmentRecord(prisma, actor, { ...base, isAdmin: true })).ok, false);

  // Accounts without clinical permission cannot read, create, update or query history.
  const beforeUnauthorized = await prisma.dentalAppointment.count();
  assert.equal((await readAppointmentRecord(prisma, reader, initial.id)).ok, false);
  assert.equal((await readPatientHistoryRecord(prisma, reader, { patientId: partnerIds[0] })).ok, false);
  assert.equal((await saveAppointmentRecord(prisma, reader, base)).ok, false);
  assert.equal((await saveAppointmentRecord(prisma, reader, { ...initial, reason: "No autorizado" })).ok, false);
  const listState = { query: initial.id!, page: 1, pageSize: 10, sort: "scheduledAt", direction: "asc" as const, filters: [] };
  const listConfig = { ...appointmentListConfig, searchFields: ["id"] };
  await assert.rejects(listAppointmentRecords(prisma, reader, listConfig, listState));
  const listed = await listAppointmentRecords(prisma, actor, listConfig, listState);
  assert.equal(listed.total, 1);
  assert.equal(listed.rows[0].id, initial.id);
  assert.equal(listed.rows[0].scheduledAt, initial.scheduledAt);
  assert.equal(Object.hasOwn(listed.rows[0], "observations"), false);
  assert.equal(Object.hasOwn(listed.rows[0], "treatments"), false);
  const matchingDay = await listAppointmentRecords(prisma, actor, listConfig, { ...listState, filters: [{ field: "scheduledAt", operator: "between", precision: "instant", value: "2026-11-06T00:00:00Z", to: "2026-11-07T00:00:00Z" }] });
  assert.equal(matchingDay.total, 1);
  const otherDay = await listAppointmentRecords(prisma, actor, listConfig, { ...listState, filters: [{ field: "scheduledAt", operator: "gte", precision: "instant", value: "2027-01-01T00:00:00Z" }] });
  assert.equal(otherDay.total, 0);
  await assert.rejects(listAppointmentRecords(prisma, actor, listConfig, { ...listState, filters: [{ field: "status", operator: "contains", value: "SCHEDULED" }] }));
  assert.equal(await prisma.dentalAppointment.count(), beforeUnauthorized);
  assert.deepEqual(successful(await readAppointmentRecord(prisma, actor, initial.id)), initial);

  const added = successful(await saveAppointmentRecord(prisma, actor, { ...initial, status: "ATTENDED", treatments: [line, { ...line, procedure: "Revisión temporal" }] }));
  assert.equal(added.status, "ATTENDED");
  assert.ok(added.treatments.every(row => row.id));
  assert.ok(Date.parse(added.revision) > Date.parse(initial.revision));
  const otherVisit = successful(await saveAppointmentRecord(prisma, actor, { ...base, treatments: [{ ...line, performedAt: "2026-11-07T15:30:00.000Z" }] }));
  appointmentIds.push(otherVisit.id!);
  const otherPatient = successful(await saveAppointmentRecord(prisma, actor, { ...base, patientId: partnerIds[1], treatments: [{ ...line, procedure: "Paciente distinto" }] }));
  appointmentIds.push(otherPatient.id!);
  const patient = await prisma.partner.findUniqueOrThrow({ where: { id: partnerIds[0] } });
  const byPatient = await listAppointmentRecords(prisma, actor, appointmentListConfig, { ...listState, query: "", sort: "patient.name", filters: [{ field: "patient.name", operator: "eq", value: patient.name }] });
  assert.equal(byPatient.total, 2);
  assert.deepEqual(new Set(byPatient.rows.map(row => row.id)), new Set([initial.id, otherVisit.id]));

  const moved = successful(await saveAppointmentRecord(prisma, actor, { ...added, treatments: [
    { ...added.treatments[1], observations: "  Revisada  " }, added.treatments[0],
  ] }));
  assert.deepEqual(moved.treatments.map(row => row.id), [added.treatments[1].id, added.treatments[0].id]);
  assert.equal(moved.treatments[0].observations, "Revisada");
  assert.ok(Date.parse(moved.revision) > Date.parse(added.revision)); // Child-only edit.
  assert.equal((await saveAppointmentRecord(prisma, actor, { ...added, reason: "Edición antigua", treatments: [] })).ok, false);
  assert.deepEqual(successful(await readAppointmentRecord(prisma, actor, initial.id)), moved);

  const foreign = await saveAppointmentRecord(prisma, actor, { ...moved, reason: "No debe guardarse", treatments: [otherVisit.treatments[0]] });
  assert.equal(foreign.ok, false);
  if (!foreign.ok) { assert.equal(foreign.kind, "validation"); assert.ok(foreign.fieldErrors?.["treatments.0.id"]); }
  assert.deepEqual(successful(await readAppointmentRecord(prisma, actor, initial.id)), moved);
  assert.deepEqual(successful(await readAppointmentRecord(prisma, actor, otherVisit.id)), otherVisit);

  const race = await Promise.all(["A", "B"].map(suffix => saveAppointmentRecord(prisma, actor, {
    ...moved, reason: `Concurrente ${suffix}`, treatments: [{ ...moved.treatments[0], procedure: `Procedimiento ${suffix}` }],
  })));
  assert.equal(race.filter(result => result.ok).length, 1);
  assert.equal(race.filter(result => !result.ok && result.kind === "validation").length, 1);
  const winner = successful(race.find(result => result.ok)!);
  assert.deepEqual(successful(await readAppointmentRecord(prisma, actor, initial.id)), winner);
  assert.equal(winner.treatments.length, 1);
  assert.equal(winner.reason.at(-1), winner.treatments[0].procedure.at(-1));

  // Revision must advance even if the previous timestamp is ahead of this clock.
  const future = new Date(Date.now() + 60000);
  await prisma.dentalAppointment.update({ where: { id: initial.id }, data: { updatedAt: future } });
  const futureSnapshot = successful(await readAppointmentRecord(prisma, actor, initial.id));
  const cancelled = successful(await saveAppointmentRecord(prisma, actor, { ...futureSnapshot, status: "CANCELLED" }));
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(Date.parse(cancelled.revision), future.getTime() + 1);

  const firstPage = successful(await readPatientHistoryRecord(prisma, actor, { patientId: partnerIds[0], pageSize: 1 }));
  const lastPage = successful(await readPatientHistoryRecord(prisma, actor, { patientId: partnerIds[0], pageSize: 1, page: 999 }));
  assert.equal(firstPage.total, 2);
  assert.equal(firstPage.pageCount, 2);
  assert.equal(lastPage.page, 2);
  assert.equal(firstPage.rows[0].appointment.id, otherVisit.id);
  assert.equal(lastPage.rows[0].appointment.id, initial.id);
  assert.notEqual(firstPage.rows[0].id, lastPage.rows[0].id);
  assert.deepEqual(JSON.parse(JSON.stringify(firstPage)), firstPage);
  const isolated = successful(await readPatientHistoryRecord(prisma, actor, { patientId: partnerIds[1] }));
  assert.equal(isolated.total, 1);
  assert.equal(isolated.rows[0].appointment.id, otherPatient.id);
  assert.equal(JSON.stringify(firstPage).includes(password), false);
  for (const query of [{ patientId: "missing-patient" }, { patientId: partnerIds[0], pageSize: 1000 }, {}]) assert.equal((await readPatientHistoryRecord(prisma, actor, query)).ok, false);

  const cleared = successful(await saveAppointmentRecord(prisma, actor, { ...cancelled, treatments: [] }));
  assert.deepEqual(cleared.treatments, []);
  assert.equal(await prisma.dentalTreatment.count({ where: { appointmentId: initial.id } }), 0);
  assert.equal(await prisma.dentalTreatment.count({ where: { appointmentId: otherVisit.id } }), 1);
  await prisma.dentalAppointment.delete({ where: { id: cleared.id } });
  assert.equal((await saveAppointmentRecord(prisma, actor, cleared)).ok, false); // No accidental recreation.

  async function denied(currentActor: typeof actor) {
    assert.equal((await readAppointmentRecord(prisma, currentActor, otherVisit.id)).ok, false);
    assert.equal((await saveAppointmentRecord(prisma, currentActor, otherVisit)).ok, false);
    assert.equal((await readPatientHistoryRecord(prisma, currentActor, { patientId: partnerIds[0] })).ok, false);
    await assert.rejects(listAppointmentRecords(prisma, currentActor, listConfig, listState));
  }
  await denied({ ...actor, sessionVersion: 1 });
  await denied({ ...actor, id: "missing-account" });
  await prisma.user.update({ where: { id: actor.id }, data: { sessionVersion: { increment: 1 } } });
  await denied(actor);
  const freshActor = { ...actor, sessionVersion: 1 };
  await prisma.user.update({ where: { id: actor.id }, data: { active: false } });
  await denied(freshActor);
  await prisma.user.update({ where: { id: actor.id }, data: { active: true, isAdmin: false } });
  await denied(freshActor);
  console.log("Appointment services passed: access, validation, atomic parent/line saves, revisions, concurrent edits, status changes, paginated isolated history and revoked sessions.");
} finally {
  await prisma.dentalTreatment.deleteMany({ where: { appointmentId: { in: appointmentIds } } });
  await prisma.dentalAppointment.deleteMany({ where: { id: { in: appointmentIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
  await prisma.$disconnect();
}
