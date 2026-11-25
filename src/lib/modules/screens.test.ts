import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import { Fields, Model } from "../orm";
import { defineModule } from "./define";
import { selectedScreen } from "./screens";
import { registerView, viewName } from "./eject";
import { screenHref, screenQuery } from "./config";
import { defineApplication, menuLinkHref } from "../applications/manifest";
import { activeApplicationMenu } from "../applications/navigation";

class Contacto extends Model {
  name = Fields.Text({ label: "Nombre", required: true, maxLength: 80 });
  type = Fields.Selection([
    { value: "contact", label: "Contacto" },
    { value: "delivery", label: "Entrega" },
    { value: "invoice", label: "Facturación" },
  ], { label: "Tipo", required: true, default: "contact" });
  activo = Fields.Boolean({ label: "Activo", default: true });
  prioridad = Fields.Integer({ label: "Prioridad", min: 1, max: 5 });
  vence = Fields.DateTime({ label: "Vence" });
}

const form = () => Promise.resolve({ default: () => null });
const screens = {
  contacts: { label: "Contactos", view: "card" as const, domain: (d: import("../orm/domain-builder").DomainBuilder) => d.eq("type", "contact"), defaults: { type: "contact" }, views: { card: true as const, list: true as const, form } },
  addresses: { label: "Direcciones", domain: (d: import("../orm/domain-builder").DomainBuilder) => d.in("type", ["delivery", "invoice"]), defaults: { type: "delivery", activo: true }, views: { modal: form } },
};
const spec = (contacto: object, menu?: object) => ({ id: "pruebas", name: "Pruebas", icon: "flask-conical", models: { contacto: { model: Contacto, ...contacto } }, ...(menu ? { menu } : {}) });

test("manifests without screens compile one implicit default screen (compatibility)", () => {
  const domain = (d: import("../orm/domain-builder").DomainBuilder) => d.eq("type", "contact");
  const [entry] = defineModule(spec({ view: "card", views: { card: true, form }, domain }) as never).models;
  assert.equal(entry.defaultScreen, "default");
  assert.deepEqual(Object.keys(entry.screens), ["default"]);
  const main = entry.screens.default;
  assert.equal(main.view, "card");
  assert.deepEqual(main.collectionViews, ["card"]);
  assert.equal(main.domain, domain);
  assert.deepEqual(main.defaults, {});
  assert.equal(entry.view, "card");
  assert.equal(entry.views.form, form);
  assert.equal(selectedScreen(entry, undefined), main);
  assert.equal(selectedScreen(entry, "default"), main);
  assert.equal(selectedScreen(entry, "otra"), undefined);
});

test("named screens compile their own views, domain and defaults; the model keeps the default screen", () => {
  const definition = defineModule(spec({ screens, defaultScreen: "contacts" }, { Contactos: { model: "contacto", screen: "contacts" }, Direcciones: { model: "contacto", screen: "addresses" } }) as never);
  const [entry] = definition.models;
  assert.equal(entry.defaultScreen, "contacts");
  assert.equal(entry.label, "Contactos");
  assert.deepEqual(entry.screens.contacts.collectionViews, ["list", "card"]);
  assert.deepEqual(entry.screens.addresses.collectionViews, ["list"]);
  assert.equal(entry.screens.addresses.view, "list");
  assert.deepEqual(entry.screens.addresses.defaults, { type: "delivery", activo: true });
  // Relations, modals of other models and plain links use the default screen views.
  assert.equal(entry.views.form, form);
  assert.equal(entry.view, "card");
  assert.equal(selectedScreen(entry, undefined)?.id, "contacts");
  assert.equal(selectedScreen(entry, "addresses")?.id, "addresses");
  assert.equal(selectedScreen(entry, "default"), undefined);
  assert.deepEqual(definition.application.menus?.map(menu => "items" in menu ? menu : { id: menu.id, href: menu.href, screen: menu.screen }), [
    { id: "contacto-contacts-list", href: "/erp/pruebas/contacto", screen: "contacts" },
    { id: "contacto-addresses-list", href: "/erp/pruebas/contacto", screen: "addresses" },
  ]);
});

test("the first screen is the default; plain and grouped menu links keep their stable ids", () => {
  const definition = defineModule(spec({ screens }, { Contactos: "contacto", Configuración: { Direcciones: { model: "contacto", screen: "addresses" } } }) as never);
  assert.equal(definition.models[0].defaultScreen, "contacts");
  const [plain, group] = definition.application.menus!;
  assert.ok(!("items" in plain));
  assert.equal(plain.id, "contacto-list");
  assert.equal(plain.screen, undefined);
  assert.ok("items" in group);
  assert.equal(group.items[0].id, "contacto-addresses-list");
  assert.equal(group.items[0].screen, "addresses");
});

test("ambiguous or invalid screen declarations are rejected", () => {
  const reject = (contacto: object, pattern: RegExp, menu?: object) => assert.throws(() => defineModule(spec(contacto, menu) as never), pattern);
  reject({ screens, domain: screens.contacts.domain }, /declara view, views y domain dentro de cada pantalla/);
  reject({ screens, views: { form } }, /dentro de cada pantalla/);
  reject({ screens, defaultScreen: "otra" }, /defaultScreen apunta a una pantalla inexistente/);
  reject({ defaultScreen: "contacts" }, /defaultScreen requiere screens/);
  reject({ screens: {} }, /al menos una pantalla/);
  reject({ screens: { Mal: { label: "X" } } }, /ID de pantalla inválido/);
  reject({ screens: { default: { label: "X" } } }, /ID de pantalla inválido o reservado/);
  reject({ screens: { uno: { label: " " } } }, /necesita label/);
  reject({ screens: { uno: { label: "Uno", view: "kanban" } } }, /pantalla uno: .*kanban/);
  reject({ screens: { uno: { label: "Uno", views: { report: form } } } }, /registro de vista inválido: report/);
  reject({ screens: { uno: { label: "Uno", domain: { type: "contact" } } } }, /domain requiere un constructor/);
  reject({ screens }, /pantalla inexistente de contacto: otra/, { Otra: { model: "contacto", screen: "otra" } });
  reject({}, /pantalla inexistente de contacto: default/, { Otra: { model: "contacto", screen: "default" } });
});

test("screen defaults only accept literal values that match editable fields", () => {
  const reject = (defaults: object, pattern: RegExp) => assert.throws(() => defineModule(spec({ screens: { uno: { label: "Uno", defaults } } }) as never), pattern);
  reject({ desconocido: "x" }, /defaults.desconocido no es un campo/);
  reject({ type: "otro" }, /defaults.type debe ser una opción declarada/);
  reject({ type: null }, /no puede ser null en un campo obligatorio/);
  reject({ activo: "sí" }, /debe ser true o false/);
  reject({ prioridad: 9 }, /entero dentro de su rango/);
  reject({ name: "x".repeat(81) }, /longitud máxima/);
  reject({ vence: "2026-01-01" }, /no admite valores propuestos para campos datetime/);
  assert.doesNotThrow(() => defineModule(spec({ screens: { uno: { label: "Uno", defaults: { name: "Nuevo", prioridad: null, activo: false } } } }) as never));
});

test("menu links carry the screen in the query and active menus tell screens apart", () => {
  const application = defineApplication({
    id: "pruebas", name: "Pruebas", description: "Pruebas.", version: "0.1.0", icon: (() => null) as never, depends: [], access: "admin", models: [], accessModels: ["pruebas.contacto"],
    menus: [
      { id: "contacto-list", label: "Todos", href: "/erp/pruebas/contacto", model: "pruebas.contacto" },
      { id: "contacto-addresses-list", label: "Direcciones", href: "/erp/pruebas/contacto", model: "pruebas.contacto", screen: "addresses" },
    ],
  });
  const [all, addresses] = application.menus as readonly import("../applications/manifest").ApplicationMenuLink[];
  assert.equal(menuLinkHref(all), "/erp/pruebas/contacto");
  assert.equal(menuLinkHref(addresses), "/erp/pruebas/contacto?screen=addresses");
  assert.equal(activeApplicationMenu(application.menus!, "/erp/pruebas/contacto")?.id, "contacto-list");
  assert.equal(activeApplicationMenu(application.menus!, "/erp/pruebas/contacto/abc", "addresses")?.id, "contacto-addresses-list");
  assert.equal(activeApplicationMenu(application.menus!, "/erp/pruebas/contacto", "otra")?.id, "contacto-list");
  assert.throws(() => defineApplication({ ...application, menus: [{ id: "x", label: "X", href: "/erp/pruebas/x", screen: "addresses" }] }), /Pantalla de menú inválida/);
  assert.throws(() => defineApplication({ ...application, menus: [{ id: "x", label: "X", href: "/erp/pruebas/contacto", model: "pruebas.contacto", screen: "Mal" }] }), /Pantalla de menú inválida/);
});

test("client links keep only non-default screens", () => {
  const named = { screen: { id: "addresses", label: "Direcciones", isDefault: false, defaults: {} } };
  const main = { screen: { id: "contacts", label: "Contactos", isDefault: true, defaults: {} } };
  assert.deepEqual(screenQuery(named), { screen: "addresses" });
  assert.deepEqual(screenQuery(main), {});
  assert.deepEqual(screenQuery({}), {});
  assert.equal(screenHref(named, "/erp/a/b/{id}"), "/erp/a/b/{id}?screen=addresses");
  assert.equal(screenHref(named, "/erp/a/b/nuevo", { returnTo: "/erp/a/b?screen=addresses" }), "/erp/a/b/nuevo?screen=addresses&returnTo=%2Ferp%2Fa%2Fb%3Fscreen%3Daddresses");
  assert.equal(screenHref(main, "/erp/a/b"), "/erp/a/b");
});

test("eject registers a view inside the selected screen and names it after the screen", () => {
  const manifest = `import { Contacto } from "./models/contacto";
import { defineModule } from "@/lib/modules/define";

export default defineModule({
  id: "pruebas",
  name: "Pruebas",
  icon: "flask-conical",
  models: {
    contacto: {
      model: Contacto,
      screens: {
        contacts: { label: "Contactos", views: { list: true } },
        addresses: {
          label: "Direcciones",
        },
      },
    },
  },
});
`;
  const parses = (text: string) => {
    const file = ts.createSourceFile("manifest.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    assert.equal((file as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics.length, 0);
    return text;
  };
  assert.equal(viewName("contacto", "form", "addresses"), "ContactoAddressesForm");
  const once = parses(registerView(manifest, "contacto", "form", "addresses"));
  assert.match(once, /addresses: \{\s+label: "Direcciones",\s+views: \{ form: \(\) => import\("\.\/views\/ContactoAddressesForm"\) \},/);
  const twice = parses(registerView(once, "contacto", "list", "contacts"));
  assert.match(twice, /contacts: \{ label: "Contactos", views: \{ list: \(\) => import\("\.\/views\/ContactoContactsList"\) \} \}/);
  assert.throws(() => registerView(manifest, "contacto", "form"), /indica la pantalla con --screen/);
  assert.throws(() => registerView(manifest, "contacto", "form", "otra"), /la pantalla otra no está declarada/);
  assert.throws(() => registerView(manifest.replace(/screens: \{[\s\S]*?\n      \},\n/, ""), "contacto", "form", "addresses"), /no declara screens/);
});
