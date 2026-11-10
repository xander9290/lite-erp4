import assert from "node:assert/strict";
import test from "node:test";
import { UsersRound } from "lucide-react";
import { applicationHref, canOpenApplication, createApplicationRegistry, defineApplication, type ApplicationManifest } from "./manifest";
import { appointmentsManifest } from "@/app/(auth)/erp/citas/manifest";
import { activeApplication, activeApplicationMenu, applicationNavigation } from "./navigation";

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

const withMenus = defineApplication({ ...contacts, menus: [
  { id: "contacts", label: "Contactos", href: "/erp/contactos" },
  { id: "management", label: "Administración", items: [
    { id: "new-contact", label: "Nuevo contacto", href: "/erp/contactos/nuevo", match: "exact", access: "admin" },
  ] },
  { id: "reports", label: "Reportes", href: "/erp/contactos/reportes", access: "admin" },
] });

test("navigation only publishes permitted applications and hides empty groups without mutating manifests", () => {
  assert.equal(applicationNavigation(withMenus, null), null);
  assert.equal(applicationNavigation(users, { isAdmin: false }), null);
  const reader = applicationNavigation(withMenus, { isAdmin: false })!;
  assert.deepEqual(reader.menus.map(item => item.id), ["contacts"]);
  const admin = applicationNavigation(withMenus, { isAdmin: true })!;
  assert.deepEqual(admin.menus.map(item => item.id), ["contacts", "management", "reports"]);
  assert.equal(withMenus.menus[1].items.length, 1);
  assert.deepEqual(Object.keys(admin).sort(), ["href", "id", "menus", "name"]);
  assert.deepEqual(applicationNavigation(contacts, { isAdmin: false })?.menus, []);
});

test("menu access inherits an administrator group even when its children declare authenticated access", () => {
  const manifest = defineApplication({ ...contacts, menus: [{ id: "admin", label: "Administración", access: "admin", items: [{ id: "list", label: "Listado", href: "/erp/contactos", access: "authenticated" }] }] });
  assert.deepEqual(applicationNavigation(manifest, { isAdmin: false })?.menus, []);
});

test("active application follows route boundaries and clears on the drawer, profile and unknown routes", () => {
  const apps = [applicationNavigation(withMenus, { isAdmin: true })!];
  for (const path of ["/erp/contactos", "/erp/contactos/nuevo", "/erp/contactos/record-id"]) assert.equal(activeApplication(apps, path)?.id, "contactos");
  for (const path of ["/erp", "/erp/perfil", "/erp/contactos-extra", "/erp/usuarios", "/other/erp/contactos"]) assert.equal(activeApplication(apps, path), undefined);
});

test("active menu chooses the most specific route across links and groups", () => {
  const menus = applicationNavigation(withMenus, { isAdmin: true })!.menus;
  assert.equal(activeApplicationMenu(menus, "/erp/contactos/record-id")?.id, "contacts");
  assert.equal(activeApplicationMenu(menus, "/erp/contactos/nuevo")?.id, "new-contact");
  assert.equal(activeApplicationMenu(menus, "/erp/contactos/nuevo/other")?.id, "contacts");
  assert.equal(activeApplicationMenu(menus, "/erp/contactos/reportes/mensual")?.id, "reports");
  assert.equal(activeApplicationMenu(menus, "/erp/contactos-extra"), undefined);
});

test("menus reject ambiguous declarations and unsafe or foreign application routes", () => {
  const link = { id: "list", label: "Listado", href: "/erp/contactos" };
  const invalid: unknown[] = [
    [{ ...link, label: " " }], [{ ...link, id: "../list" }], [link, link],
    [{ ...link, access: "all" }], [{ ...link, match: "contains" }],
    [{ id: "group", label: "Grupo", items: [] }],
    [{ id: "group", label: "Grupo", href: "/erp/contactos", items: [link] }],
    [{ id: "group", label: "Grupo", items: [{ id: "nested", label: "Otro", items: [link] }] }],
    [link, { id: "group", label: "Grupo", items: [link] }],
  ];
  for (const href of ["https://example.test/erp/contactos", "//example.test/erp/contactos", "/erp/usuarios", "/erp/contactos-extra", "/erp/contactos/../usuarios", "/erp/contactos/%2e%2e/usuarios", "/erp/contactos\\nuevo", "/erp/contactos?q=x", "/erp/contactos#x"]) invalid.push([{ ...link, href }]);
  for (const menus of invalid) assert.throws(() => defineApplication({ ...contacts, menus } as ApplicationManifest));
});
