import assert from "node:assert/strict";
import test from "node:test";
import { UsersRound } from "lucide-react";
import { applicationHref, canOpenApplication, createApplicationRegistry, defineApplication, type ApplicationManifest } from "./manifest";
import { appointmentsManifest } from "@/app/(auth)/erp/citas/manifest";

const contacts = defineApplication({ id: "contactos", name: "Contactos", description: "Contactos compartidos.", version: "0.1.0", icon: UsersRound, depends: [], access: "authenticated", models: ["Partner"] });
const users = defineApplication({ ...contacts, id: "usuarios", name: "Usuarios", access: "admin", depends: ["contactos"], models: ["User"] });

test("dental appointments depend on contacts and are available only to administrators", () => {
  const registry = createApplicationRegistry([appointmentsManifest, contacts]);
  assert.deepEqual(registry.all().map(app => app.id), ["contactos", "citas"]);
  assert.deepEqual(registry.forUser({ isAdmin: false }).map(app => app.id), ["contactos"]);
  assert.equal(canOpenApplication(appointmentsManifest, null), false);
  assert.equal(canOpenApplication(appointmentsManifest, { isAdmin: true }), true);
  assert.deepEqual(appointmentsManifest.models, ["DentalAppointment", "DentalTreatment"]);
  assert.equal(applicationHref(appointmentsManifest), "/erp/citas");
});

test("registered dependencies precede consumers and model ownership is explicit", () => {
  const registry = createApplicationRegistry([users, contacts]);
  assert.deepEqual(registry.all().map(app => app.id), ["contactos", "usuarios"]);
  assert.equal(registry.get("contactos"), contacts);
  assert.equal(registry.get("missing"), undefined);
  assert.equal(applicationHref(contacts), "/erp/contactos");
  assert.deepEqual(contacts.models, ["Partner"]);
});

test("anonymous accounts see no apps; only admins see the users app", () => {
  const registry = createApplicationRegistry([contacts, users]);
  assert.deepEqual(registry.forUser(null), []);
  assert.deepEqual(registry.forUser({ isAdmin: false }).map(app => app.id), ["contactos"]);
  assert.deepEqual(registry.forUser({ isAdmin: true }).map(app => app.id), ["contactos", "usuarios"]);
  assert.equal(canOpenApplication(users, { isAdmin: false }), false);
  assert.equal(canOpenApplication(contacts, null), false);
  assert.equal(canOpenApplication(users, { isAdmin: true }), true);
});

test("manifests reject unsafe routes, reserved routes and invalid declarations", () => {
  for (const id of ["../auth", "perfil", "/erp/contactos", "Contactos", "contactos/nuevo", "", "__proto__"]) assert.throws(() => defineApplication({ ...contacts, id }));
  assert.throws(() => defineApplication({ ...contacts, name: " " }));
  assert.throws(() => defineApplication({ ...contacts, description: " " }));
  assert.throws(() => defineApplication({ ...contacts, version: "latest" }));
  assert.throws(() => defineApplication({ ...contacts, models: ["Partner", "Partner"] }));
  assert.throws(() => defineApplication({ ...contacts, models: ["../User"] }));
  assert.throws(() => defineApplication({ ...contacts, depends: ["contactos"] }));
  assert.throws(() => defineApplication({ ...contacts, access: "everyone" } as unknown as ApplicationManifest));
});

test("registration rejects missing dependencies, cycles, duplicate apps and duplicate model owners", () => {
  assert.throws(() => createApplicationRegistry([users]), /dependencia contactos/);
  assert.throws(() => createApplicationRegistry([contacts, contacts]), /duplicada/);
  assert.throws(() => createApplicationRegistry([contacts, { ...users, models: ["Partner"] }]), /ya pertenece/);
  assert.throws(() => createApplicationRegistry([{ ...contacts, depends: ["usuarios"] }, users]), /circular/);
  assert.throws(() => defineApplication({ ...users, depends: ["contactos", "contactos"] }), /Dependencias/);
});
