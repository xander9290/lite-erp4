import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { groupDetail, setModelAccess, setFieldRestrictions, setActionRestrictions, setMenuVisibility, setPageVisibility } from "./admin";

const actor = { id: "admin", sessionVersion: 1 };
const adjusted = { read: true, create: false, write: true, unlink: false, import: true, export: false };

function fixture(isAdmin = true) {
  const updates: unknown[] = [];
  const tx = {
    user: { findUnique: async () => ({ active: true, isAdmin, sessionVersion: 1 }), findMany: async () => [] },
    accessUserGroup: { findMany: async () => [] },
    accessRuleState: { findMany: async () => [] },
    accessFieldRestriction: { findMany: async () => [], upsert: async (args: unknown) => { updates.push(args); }, deleteMany: async (args: unknown) => { updates.push(args); } },
    accessActionRestriction: { findMany: async () => [] },
    accessPageHidden: { findMany: async () => [{ groupId: "directory.auxiliar", model: "directory.partner", screen: "contacts", layout: "form", notebook: "additionalInfo", page: "sales" }], upsert: async (args: unknown) => { updates.push(args); }, deleteMany: async (args: unknown) => { updates.push(args); } },
    accessMenuHidden: { findMany: async () => [], upsert: async (args: unknown) => { updates.push(args); }, deleteMany: async (args: unknown) => { updates.push(args); } },
    accessModelOverride: {
      findMany: async () => [
        { groupId: "ubicaciones.gestor", model: "ubicaciones.pais", ...adjusted, canImport: true, canExport: false },
        { groupId: "ubicaciones.gestor", model: "core.user", ...adjusted, canImport: true, canExport: false },
      ],
      upsert: async (args: unknown) => { updates.push(args); },
      deleteMany: async (args: unknown) => { updates.push(args); },
    },
  } as unknown as Prisma.TransactionClient;
  const prisma = { $transaction: async (run: (tx: Prisma.TransactionClient) => Promise<unknown>) => run(tx) } as unknown as PrismaClient;
  return { prisma, updates };
}

test("group detail lists only its module models and keeps saved adjustments", async () => {
  const f = fixture();
  const detail = await groupDetail(f.prisma, actor, "ubicaciones.gestor");
  assert.deepEqual(detail?.models.map(model => model.id).sort(), ["ubicaciones.estado", "ubicaciones.localidad", "ubicaciones.municipio", "ubicaciones.pais"]);
  assert.deepEqual(detail?.models.find(model => model.id === "ubicaciones.pais")?.perms, adjusted);
  assert.equal(detail?.models.find(model => model.id === "ubicaciones.pais")?.overridden, true);
  assert.deepEqual(f.updates, [], "opening the group never rewrites saved overrides");
});

test("field policies reject foreign, unknown and duplicate fields before writing", async () => {
  const f = fixture();
  const policy = { noRead: true, noWrite: false, invisible: false, readOnly: false };
  const valid = { model: "ubicaciones.pais", field: "name", policy };
  for (const changes of [[valid, { ...valid, model: "core.user" }], [{ ...valid, field: "password" }], [valid, valid]]) {
    await assert.rejects(setFieldRestrictions(f.prisma, actor, "ubicaciones.gestor", changes), /No tienes permiso/);
  }
  assert.deepEqual(f.updates, []);
  await setFieldRestrictions(f.prisma, actor, "ubicaciones.gestor", [valid]);
  assert.equal((f.updates[0] as { update: typeof policy }).update.noWrite, true);
  await setFieldRestrictions(f.prisma, actor, "ubicaciones.gestor", [{ ...valid, policy: { ...policy, noRead: false } }]);
  assert.deepEqual(f.updates[1], { where: { groupId: "ubicaciones.gestor", model: "ubicaciones.pais", field: "name" } });
});

test("only administrators change field policies; actions must be declared by the owning model", async () => {
  const f = fixture(false);
  await assert.rejects(setFieldRestrictions(f.prisma, actor, "ubicaciones.gestor", [{ model: "ubicaciones.pais", field: "name", policy: { noRead: false, noWrite: true, invisible: false, readOnly: false } }]), /permisos de administrador/);
  await assert.rejects(setActionRestrictions(f.prisma, actor, "ubicaciones.gestor", [{ model: "ubicaciones.pais", action: "invented", blocked: true }]), /No tienes permiso/);
  assert.deepEqual(f.updates, []);
});

test("foreign model in a mixed permission batch rejects every write", async () => {
  const f = fixture();
  await assert.rejects(setModelAccess(f.prisma, actor, "ubicaciones.gestor", new Map([
    ["ubicaciones.pais", adjusted], ["core.user", adjusted],
  ])), /No tienes permiso/);
  assert.deepEqual(f.updates, []);
});

test("permissions of the owning module remain editable", async () => {
  const f = fixture();
  await setModelAccess(f.prisma, actor, "ubicaciones.gestor", new Map([["ubicaciones.pais", adjusted]]));
  assert.equal(f.updates.length, 1);
  assert.deepEqual((f.updates[0] as { update: unknown }).update, {
    read: true, create: false, write: true, unlink: false, canImport: true, canExport: false,
  });
});

test("menu administration accepts registered own menus only, rejects mixed batches and requires admin", async () => {
  const f = fixture();
  const own = { application: "ubicaciones", menu: "pais-list", hidden: true };
  for (const changes of [[own, { ...own, application: "contactos", menu: "contacts" }], [own, own], [{ ...own, menu: "invented" }]]) {
    await assert.rejects(setMenuVisibility(f.prisma, actor, "ubicaciones.gestor", changes), /No tienes permiso/);
  }
  assert.deepEqual(f.updates, []);
  await assert.rejects(setMenuVisibility(fixture(false).prisma, actor, "ubicaciones.gestor", [own]), /administrador/);
  await setMenuVisibility(f.prisma, actor, "ubicaciones.gestor", [own]);
  assert.deepEqual(f.updates, [{ where: { groupId_application_menu: { groupId: "ubicaciones.gestor", application: "ubicaciones", menu: "pais-list" } }, create: { groupId: "ubicaciones.gestor", application: "ubicaciones", menu: "pais-list" }, update: {} }]);
  await setMenuVisibility(f.prisma, actor, "ubicaciones.gestor", [{ ...own, hidden: false }]);
  assert.deepEqual(f.updates[1], { where: { groupId: "ubicaciones.gestor", application: "ubicaciones", menu: "pais-list" } });
  assert.ok((await groupDetail(f.prisma, actor, "ubicaciones.gestor"))?.menus.some(menu => menu.id === "pais-list"));
});

test("page administration lists the module catalog per screen and layout and accepts declared pages only", async () => {
  const f = fixture();
  const detail = await groupDetail(f.prisma, actor, "directory.auxiliar");
  const pages = detail?.pages ?? [];
  assert.equal(pages.length, 2 * 2 * 4, "dos pantallas × formulario/modal × cuatro páginas de Partner");
  assert.deepEqual(pages.filter(page => page.hidden).map(page => [page.screen, page.layout, page.notebook, page.page]), [["contacts", "form", "additionalInfo", "sales"]]);
  assert.ok(pages.every(page => page.model === "directory.partner"));
  const own = { model: "directory.partner", screen: "addresses", layout: "modal", notebook: "additionalInfo", page: "purchase", hidden: true };
  for (const changes of [[own, own], [{ ...own, page: "invented" }], [{ ...own, screen: "default" }], [{ ...own, layout: "page" }], [{ ...own, model: "ubicaciones.pais" }]]) {
    await assert.rejects(setPageVisibility(f.prisma, actor, "directory.auxiliar", changes), /No tienes permiso/);
  }
  await assert.rejects(setPageVisibility(f.prisma, actor, "ubicaciones.gestor", [own]), /No tienes permiso/, "un grupo sólo configura su módulo");
  assert.deepEqual(f.updates, []);
  await assert.rejects(setPageVisibility(fixture(false).prisma, actor, "directory.auxiliar", [own]), /administrador/);
  await setPageVisibility(f.prisma, actor, "directory.auxiliar", [own]);
  const where = { groupId: "directory.auxiliar", model: "directory.partner", screen: "addresses", layout: "modal", notebook: "additionalInfo", page: "purchase" };
  assert.deepEqual(f.updates, [{ where: { groupId_model_screen_layout_notebook_page: where }, create: where, update: {} }]);
  await setPageVisibility(f.prisma, actor, "directory.auxiliar", [{ ...own, hidden: false }]);
  assert.deepEqual(f.updates[1], { where });
});
