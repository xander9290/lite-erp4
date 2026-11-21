import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { groupDetail, setModelAccess, setFieldRestrictions, setActionRestrictions } from "./admin";

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
    accessModelOverride: {
      findMany: async () => [
        { groupId: "ubicaciones.gestor", model: "ubicaciones.pais", ...adjusted, canImport: true, canExport: false },
        { groupId: "ubicaciones.gestor", model: "core.partner", ...adjusted, canImport: true, canExport: false },
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
  for (const changes of [[valid, { ...valid, model: "core.partner" }], [{ ...valid, field: "password" }], [valid, valid]]) {
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
    ["ubicaciones.pais", adjusted], ["core.partner", adjusted],
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
