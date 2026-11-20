import assert from "node:assert/strict";
import test from "node:test";
import { UsersRound } from "lucide-react";
import { applicationHref, canOpenApplication, createApplicationRegistry, defineApplication, type ApplicationManifest } from "./manifest";
import { activeApplication, activeApplicationMenu, applicationNavigation } from "./navigation";

const contacts = defineApplication({ id: "contactos", name: "Contactos", description: "Contactos compartidos.", version: "0.1.0", icon: UsersRound, depends: [], access: "authenticated", models: ["Partner"] });
const users = defineApplication({ ...contacts, id: "usuarios", name: "Usuarios", access: "admin", depends: ["contactos"], models: ["User"] });

test("applications presenting core models follow native read capabilities and fail closed without a snapshot", () => {
  const app = defineApplication({ ...contacts, accessModels: ["core.partner"], menus: [{ id: "contacts", label: "Contactos", href: "/erp/contactos", model: "core.partner" }] });
  assert.equal(canOpenApplication(app, { isAdmin: false }), false);
  const allowed = { isAdmin: false, modelAccess: { "core.partner": { read: true, create: false, write: false, unlink: false } } };
  assert.equal(canOpenApplication(app, allowed), true);
  assert.equal(applicationNavigation(app, allowed)?.menus.length, 1);
  assert.equal(canOpenApplication(app, { ...allowed, modelAccess: {} }), false);
  assert.throws(() => defineApplication({ ...app, accessModels: ["other.partner"] }), /Modelos de acceso inválidos/);
});

test("effective model reads control declarative apps/menus, overrides and empty groups; native apps keep their contract", () => {
  const app = defineApplication({ ...contacts, groups: ["contactos.default"], accessModels: ["contactos.item", "contactos.catalog"], menus: [
    { id: "items", label: "Items", href: "/erp/contactos/item", model: "contactos.item", groups: ["contactos.default"] },
    { id: "settings", label: "Configuración", groups: ["contactos.default"], items: [{ id: "catalog", label: "Catálogo", href: "/erp/contactos/catalog", model: "contactos.catalog", groups: ["contactos.default"] }] },
  ] });
  const read = { read: true, create: false, write: false, unlink: false };
  const denied = { ...read, read: false };
  const actor = { isAdmin: false, groups: new Set(["override.group"]), modelAccess: { "contactos.item": read, "contactos.catalog": denied } };
  assert.equal(canOpenApplication(app, actor), true, "effective override can grant read without a default reader group");
  assert.deepEqual(applicationNavigation(app, actor)?.menus.map(item => item.id), ["items"]);
  const inverse = { ...actor, modelAccess: { "contactos.item": denied, "contactos.catalog": read } };
  assert.deepEqual(applicationNavigation(app, inverse)?.menus.map(item => item.id), ["settings"]);
  assert.equal(applicationNavigation(app, { ...actor, modelAccess: {} }), null);
  assert.equal(canOpenApplication(contacts, { ...actor, modelAccess: {} }), true);
  assert.equal(canOpenApplication(users, actor), false);
  assert.equal(canOpenApplication(users, { ...actor, isAdmin: true }), true);
  assert.equal(app.menus[1].items.length, 1, "filtering never mutates manifests");
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

const locations = defineApplication({ ...contacts, id: "ubicaciones", name: "Ubicaciones", models: ["UbicacionesPais"], accessModels: ["ubicaciones.pais"], menus: [] });
const locationLink = { id: "countries", label: "Países", model: "ubicaciones.pais", href: "/erp/ubicaciones/pais" };

test("dependency model menus keep application access separate and follow destination read capabilities", () => {
  const app = defineApplication({ ...contacts, depends: ["ubicaciones"], accessModels: ["core.partner"], menus: [
    { id: "contacts", label: "Contactos", href: "/erp/contactos", model: "core.partner" },
    { id: "settings", label: "Configuración", items: [locationLink] },
  ] });
  const registry = createApplicationRegistry([app, locations]);
  assert.deepEqual(registry.all().map(item => item.id), ["ubicaciones", "contactos"]);
  const read = { read: true, create: false, write: false, unlink: false };
  const actor = { isAdmin: false, modelAccess: { "core.partner": read, "ubicaciones.pais": read } };
  assert.deepEqual(applicationNavigation(app, actor)?.menus.map(item => item.id), ["contacts", "settings"]);
  assert.deepEqual(applicationNavigation(app, { ...actor, modelAccess: { "core.partner": read } })?.menus.map(item => item.id), ["contacts"]);
  assert.equal(applicationNavigation(app, { ...actor, modelAccess: { "ubicaciones.pais": read } }), null, "catalog read alone does not open Contactos");
  assert.equal(applicationNavigation(app, { isAdmin: true }), null, "model capabilities must be supplied even for admin presentation");
  assert.deepEqual(app.accessModels, ["core.partner"], "a menu does not add grants or application entry models");
  assert.equal(app.menus[1].items.length, 1);
  const manual = defineApplication({ ...contacts, depends: ["ubicaciones"], menus: [locationLink] });
  assert.deepEqual(applicationNavigation(manual, { isAdmin: true })?.menus, [], "dependency links also fail closed in manual apps without a snapshot");
});

test("dependency links require a direct dependency, matching model route and a published destination model", () => {
  const app = { ...contacts, depends: ["ubicaciones"], menus: [locationLink] };
  assert.throws(() => defineApplication({ ...app, depends: [] }), /Modelo de menú/);
  for (const href of ["/erp/ubicaciones", "/erp/ubicaciones/pais/nuevo", "/erp/ubicaciones/estado", "/erp/contactos", "/erp/ubicaciones-extra/pais", "https://example.test/erp/ubicaciones/pais", "/erp/ubicaciones/pais?q=x", "/erp/ubicaciones/pais#x", "/erp/ubicaciones/%70ais"]) {
    assert.throws(() => defineApplication({ ...app, menus: [{ ...locationLink, href }] }), /Ruta de menú/);
  }
  assert.throws(() => defineApplication({ ...app, menus: [{ id: "countries", label: "Países", href: locationLink.href }] }), /Ruta de menú/);
  assert.throws(() => createApplicationRegistry([defineApplication(app)]), /dependencia ubicaciones/);
  assert.throws(() => createApplicationRegistry([defineApplication({ ...app, menus: [{ ...locationLink, model: "ubicaciones.inexistente", href: "/erp/ubicaciones/inexistente" }] }), locations]), /no está publicado/);
  const bridge = defineApplication({ ...contacts, id: "puente", models: [], depends: ["ubicaciones"] });
  assert.throws(() => defineApplication({ ...contacts, depends: ["puente"], menus: [locationLink] }), /Modelo de menú/, "transitive dependency is not sufficient");
  assert.deepEqual(createApplicationRegistry([bridge, locations]).all().map(item => item.id), ["ubicaciones", "puente"]);
});
