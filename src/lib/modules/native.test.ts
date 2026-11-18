import assert from "node:assert/strict";
import { test } from "node:test";
import { Fields, Model } from "../orm";
import core from "../core/manifest";
import { Partner } from "../core/models/partner";
import { defineModule } from "./define";
import { composeModules } from "./compose";
import { extendModel } from "./extend";
import { createRepository } from "./repository";
import { generateModule } from "../orm/generator/generate";
import { internalGroup, userGroups } from "../access/engine";

test("core is a native module over the hand-written partners table, without an app of its own", () => {
  assert.equal(core.native, true);
  const [partner] = core.models;
  assert.equal(partner.id, "core.partner");
  assert.equal(partner.contract.name, "Partner");
  assert.equal(partner.contract.table, "partners");
  assert.equal(partner.delegate, "partner");
  assert.deepEqual(core.application.menus, []);
  assert.deepEqual(Object.keys(partner.metadata), ["name", "email", "phone", "avatarUrl"]);
  assert.ok(core.access.groups.some(group => group.id === internalGroup));
});

test("native options are reserved and core is an implicit dependency", () => {
  class Item extends Model { name = Fields.Text({ label: "Nombre" }); }
  assert.throws(() => defineModule({ id: "otro", name: "Otro", icon: "box", models: { item: { model: Item, name: "Item" } } }), /nativos/);
  assert.throws(() => defineModule({ id: "core", name: "Core", icon: "box", models: { item: Item } }), /nativo del framework/);
  assert.throws(() => defineModule({ id: "otro", name: "Otro", icon: "box", depends: ["core"], models: { item: Item } }), /implícito/);
  assert.throws(() => defineModule({ id: "nativo", name: "N", icon: "box", native: true, models: { item: Item }, menu: { Items: "item" } }), /no declara menús/);
});

test("modules relate to and extend Partner without declaring core; the schema links to partners", () => {
  class Cliente extends Model {
    name = Fields.Text({ label: "Nombre", required: true });
    contactoId = Fields.Many2one("Partner", { label: "Contacto" });
  }
  const ventas = defineModule({ id: "ventas", name: "Ventas", icon: "store", models: { cliente: Cliente } });
  const schema = `datasource db {\n  provider = "postgresql"\n}\n\nmodel User {\n  id String @id @default(cuid())\n}\n\nmodel Partner {\n  id String @id @default(cuid())\n  name String\n  @@map("partners")\n}\n`;
  const files = generateModule(ventas.profile.module, { schema, owners: {} });
  assert.match(files["models.prisma"], /contacto Partner\? @relation\("VentasCliente_contactoId", fields: \[contactoId\], references: \[id\], onDelete: Restrict\)/);
  const review = JSON.parse(files["review.json"]) as { relations: { target: string; owner: string }[] };
  assert.ok(review.relations.some(relation => relation.target === "Partner" && relation.owner === "@core"));

  const PartnerCrm = extendModel(Partner, Base => { class PartnerCrm extends Base { empresa = Fields.Text({ label: "Empresa", maxLength: 80 }); } return PartnerCrm; });
  const crm = defineModule({ id: "crm", name: "CRM", icon: "users", models: {}, extends: { "core.partner": PartnerCrm } });
  assert.equal(crm.extensions[0].companion?.name, "CrmCorePartner");
  const companion = generateModule(crm.profile.module, { schema, owners: {} });
  assert.match(companion["models.prisma"], /record Partner @relation\("CrmCorePartner_recordId", fields: \[recordId\], references: \[id\], onDelete: Cascade\)/);
  const [composed] = composeModules([core, crm]);
  assert.deepEqual(Object.keys(composed.models[0].metadata), ["name", "email", "phone", "avatarUrl", "empresa"]);
});

test("native repository writes no creator column and reads only dates as audit", async () => {
  const calls: Record<string, unknown>[] = [];
  const updatedAt = new Date("2026-11-18T10:00:00.000Z");
  const row = { id: "p1", updatedAt, createdAt: updatedAt, name: "Ana", email: null, phone: null, avatarUrl: null };
  const delegate = {
    findMany: async () => [],
    findUnique: async (args: Record<string, unknown>) => { calls.push(args); return row; },
    create: async (args: Record<string, unknown>) => { calls.push(args); return row; },
  };
  const [partner] = core.models;
  const repository = createRepository(partner, core.profile.module, core.models, { creator: false });
  await repository.create({ partner: delegate } as never, { name: "Ana", email: null, phone: null, avatarUrl: null } as never, "u1");
  assert.equal(Object.hasOwn(calls[0].data as object, "createBy"), false);
  assert.deepEqual(await repository.audit!({ partner: delegate } as never, "p1"), { createdAt: updatedAt.toISOString(), updatedAt: updatedAt.toISOString(), createBy: null });
  assert.deepEqual(calls[1].select, { createdAt: true, updatedAt: true });
});

test("every account belongs implicitly to the internal group, which reads contacts", async () => {
  const tx = { accessUserGroup: { findMany: async () => [] } } as never;
  assert.deepEqual([...await userGroups(tx, "u1")], [internalGroup]);
  assert.deepEqual(core.access.grants.find(grant => grant.model === "core.partner")?.perms, { read: true, create: false, write: false, unlink: false });
});

test("core.user delegates contact fields to its Partner and keeps the password write-only", async () => {
  const user = core.models.find(model => model.id === "core.user")!;
  assert.equal(user.contract.name, "User");
  assert.deepEqual(user.extensions.map(({ label, fields, relation, inherits }) => ({ label, fields, relation, inherits })), [{ label: "Contacto", fields: ["name", "email", "phone", "avatarUrl"], relation: "partner", inherits: true }]);
  const password = user.metadata.password;
  assert.equal(password.kind === "text" && password.writeOnly, true);
  assert.equal(password.sensitive, true);
  assert.ok(!user.list.fields.includes("password"));
  assert.ok(!core.access.grants.some(grant => grant.model === "core.user"), "las cuentas son sólo para admin");
  assert.throws(() => Fields.Text({ writeOnly: true, required: true }), /writeOnly/);
  assert.throws(() => createRepository(user, core.profile.module, core.models, { creator: false }), /writeOnly necesita/);

  const calls: [string, Record<string, unknown>][] = [];
  const updatedAt = new Date("2026-11-18T10:00:00.000Z");
  const stored = { id: "u1", updatedAt, login: "ana", password: "$2b$hash", active: true, isAdmin: false, lastLogin: null, partner: { name: "Ana", email: null, phone: null, avatarUrl: null, updatedAt } };
  const tx = { user: {
    findMany: async () => [],
    findUnique: async (args: Record<string, unknown>) => { calls.push(["findUnique", args]); return stored; },
    create: async (args: Record<string, unknown>) => { calls.push(["create", args]); return stored; },
    update: async (args: Record<string, unknown>) => { calls.push(["update", args]); return stored; },
  } } as never;
  const repository = createRepository(user, core.profile.module, core.models, { creator: false, ...user.declaration.repository });
  const read = await repository.read(tx, "u1") as Record<string, unknown>;
  assert.equal(read.password, null, "el hash nunca se devuelve");
  assert.equal(read.name, "Ana");
  assert.equal(Object.hasOwn(calls[0][1].select as object, "password"), false);
  const values = { login: "ana", name: "Ana", email: null, phone: null, avatarUrl: null, password: "secreta123", active: true, isAdmin: false, lastLogin: "2020-01-01T00:00:00.000Z" };
  await repository.create(tx, values as never, "admin");
  const created = calls[1][1].data as Record<string, unknown>;
  assert.match(String(created.password), /^\$2[aby]\$/);
  assert.deepEqual(created.partner, { create: { name: "Ana", email: null, phone: null, avatarUrl: null } }, "crea su contacto en la misma sentencia, sin createBy");
  assert.equal(Object.hasOwn(created, "lastLogin"), false, "lastLogin lo mantiene la autenticación");
  await repository.update(tx, "u1", updatedAt.toISOString(), { ...values, password: null, isAdmin: true } as never);
  const updated = calls.find(([kind]) => kind === "update")![1].data as Record<string, unknown>;
  assert.equal(Object.hasOwn(updated, "password"), false, "contraseña vacía conserva la guardada");
  assert.deepEqual(updated.sessionVersion, { increment: 1 }, "cambiar el rol revoca las sesiones");
  const contactData = { name: "Ana", email: null, phone: null, avatarUrl: null, updatedAt: updated.updatedAt };
  assert.deepEqual(updated.partner, { upsert: { create: contactData, update: contactData } });
  assert.ok((updated.updatedAt as Date).getTime() > stored.partner.updatedAt.getTime());
});

test("core.user business rules: password on create, last admin and self-protection", async () => {
  const user = core.models.find(model => model.id === "core.user")!;
  const tx = { user: { count: async () => 1 } } as never;
  const actor = { id: "a1", sessionVersion: 0 };
  const base = { login: "ana", name: "Ana", email: null, phone: null, avatarUrl: null, password: null, active: true, isAdmin: true, lastLogin: null };
  await assert.rejects(user.contract.beforeSave(base as never, { tx, actor, operation: "create", previous: null } as never), /contraseña/);
  await assert.rejects(user.contract.beforeSave({ ...base, isAdmin: false } as never, { tx, actor, operation: "update", id: "a1", previous: base } as never), /propia cuenta/);
  await assert.rejects(user.contract.beforeSave({ ...base, active: false } as never, { tx, actor, operation: "update", id: "b2", previous: base } as never), /al menos un administrador/);
  await assert.rejects(user.contract.beforeSave({ ...base, password: "corta" } as never, { tx, actor, operation: "create", previous: null } as never), (error: { fieldErrors?: Record<string, string> }) => /8 caracteres/.test(error.fieldErrors?.password ?? ""));
  await assert.rejects(user.contract.beforeRemove!(base, { tx, actor, id: "a1" }), /propia cuenta/);
  await assert.rejects(user.contract.beforeRemove!(base, { tx, actor, id: "b2" }), /al menos un administrador/);
});
