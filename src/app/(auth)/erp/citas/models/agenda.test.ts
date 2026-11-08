import assert from "node:assert/strict";
import test from "node:test";
import { appointmentAgenda } from "../agenda";
import { appointmentReturnHref } from "../navigation";

test("agenda uses the clinic's calendar days across midnight, months and years", () => {
  const now = new Date("2026-11-07T05:50:00.000Z"); // Still November 6 in Mexico City.
  assert.equal(appointmentAgenda(new Date("2026-11-07T05:59:00Z"), "SCHEDULED", now).text, "Hoy");
  assert.equal(appointmentAgenda(new Date("2026-11-07T06:01:00Z"), "SCHEDULED", now).text, "Falta 1 día");
  assert.equal(appointmentAgenda(new Date("2026-11-08T15:00:00Z"), "SCHEDULED", now).text, "Faltan 2 días");
  assert.equal(appointmentAgenda(new Date("2026-11-05T15:00:00Z"), "SCHEDULED", now).text, "1 día de atraso");
  assert.equal(appointmentAgenda(new Date("2026-11-04T15:00:00Z"), "SCHEDULED", now).text, "2 días de atraso");
  assert.equal(appointmentAgenda(new Date("2027-01-01T15:00:00Z"), "SCHEDULED", new Date("2026-12-31T15:00:00Z")).text, "Falta 1 día");
  assert.equal(appointmentAgenda(new Date("2024-03-01T15:00:00Z"), "SCHEDULED", new Date("2024-02-28T15:00:00Z")).text, "Faltan 2 días");
});

test("attended and cancelled appointments show their state without overdue indicators", () => {
  const scheduled = new Date("2020-01-01T15:00:00Z"), now = new Date("2026-11-07T15:00:00Z");
  assert.deepEqual(appointmentAgenda(scheduled, "ATTENDED", now), { text: "Atendida", tone: "success" });
  assert.deepEqual(appointmentAgenda(scheduled, "CANCELLED", now), { text: "Cancelada", tone: "neutral" });
});

test("form return links preserve the list's filters and reject external or unrelated destinations", () => {
  assert.equal(appointmentReturnHref("/erp/citas?page=2&sort=reason"), "/erp/citas?page=2&sort=reason");
  for (const value of [undefined, "https://example.test/erp/citas", "//example.test/erp/citas", "/erp/usuarios", "/erp/citas/nuevo", "/\\example.test/erp/citas", "/erp/citas\n"]) assert.equal(appointmentReturnHref(value), "/erp/citas");
});
