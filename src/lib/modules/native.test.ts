import assert from "node:assert/strict";
import { test } from "node:test";
import { Fields, Model } from "../orm";
import core from "../core/manifest";
import { User } from "../core/models/user";
import { defineModule } from "./define";
import { composeModules } from "./compose";
import { extendModel } from "./extend";
import { createRepository } from "./repository";
import { generateModule } from "../orm/generator/generate";
import { userGroups } from "../access/engine";

test("core registers only autonomous User accounts, without a business directory", () => {
  assert.equal(core.native, true);
  assert.deepEqual(core.models.map(model => model.id), ["core.user"]);
  const [user] = core.models;
  assert.equal(user.contract.name, "User");
  assert.equal(user.contract.table, "users");
  assert.equal(user.delegate, "user");
  assert.deepEqual(user.extensions, []);
  assert.deepEqual(core.application.menus, []);
  assert.deepEqual(core.access.groups, []);
});

test("native options are reserved and core is an implicit dependency", () => {
  class Item extends Model { name = Fields.Text({ label: "Nombre" }); }
  assert.throws(() => defineModule({ id: "otro", name: "Otro", icon: "box", models: { item: { model: Item, name: "Item" } } }), /nativos/);
  assert.throws(() => defineModule({ id: "core", name: "Core", icon: "box", models: { item: Item } }), /nativo del framework/);
  assert.throws(() => defineModule({ id: "otro", name: "Otro", icon: "box", depends: ["core"], models: { item: Item } }), /implícito/);
  assert.throws(() => defineModule({ id: "nativo", name: "N", icon: "box", native: true, models: { item: Item }, menu: { Items: "item" } }), /no declara menús/);
});

test("modules relate to and extend User without declaring core", () => {
  class Item extends Model { responsableId = Fields.Many2one("User"); }
  const app = defineModule({ id: "ventas", name: "Ventas", icon: "store", models: { item: Item } });
  const schema = `datasource db {
 provider = "postgresql"
}
model User {
 id String @id
}
`;
  const files = generateModule(app.profile.module, { schema, owners: {} });
  assert.match(files["models.prisma"], /responsable User\? @relation/);
  const Extra = extendModel(User, Base => { class Extra extends Base { empresa = Fields.Text(); } return Extra; });
  const crm = defineModule({ id: "crm", name: "CRM", icon: "users", models: {}, extends: { "core.user": Extra } });
  const [composed] = composeModules([core, crm]);
  assert.ok(composed.models[0].metadata.empresa);
  assert.throws(() => generateModule(defineModule({ id: "otro", name: "Otro", icon: "box", models: { item: class extends Model { contactoId = Fields.Many2one("Partner"); } } }).profile.module, { schema, owners: {} }), /Partner/);
});

test("accounts receive no implicit group or contact grant", async () => {
  const tx = { accessUserGroup: { findMany: async () => [] } } as never;
  assert.deepEqual([...await userGroups(tx, "u1")], []);
  assert.deepEqual(core.access.grants, []);
});

test("core.user stores its own profile and keeps the password write-only", async () => {
  const user = core.models.find(model => model.id === "core.user")!;
  assert.equal(user.contract.name, "User");
  assert.deepEqual(user.extensions, []);
  const password = user.metadata.password;
  assert.equal(password.kind === "text" && password.writeOnly, true);
  assert.equal(password.sensitive, true);
  assert.ok(!user.list.fields.includes("password"));
  assert.ok(!core.access.grants.some(grant => grant.model === "core.user"), "las cuentas son sólo para admin");
  assert.throws(() => Fields.Text({ writeOnly: true, required: true }), /writeOnly/);
  assert.throws(() => createRepository(user, core.profile.module, core.models, { creator: false }), /writeOnly necesita/);

  const calls: [string, Record<string, unknown>][] = [];
  const updatedAt = new Date("2026-11-18T10:00:00.000Z");
  const stored = { id: "u1", updatedAt, login: "ana", password: "$2b$hash", active: true, isAdmin: false, lastLogin: null, name: "Ana", email: null, phone: null, avatarUrl: null };
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
  assert.equal(created.name, "Ana");
  assert.equal(Object.hasOwn(created, "partner"), false);
  assert.equal(Object.hasOwn(created, "createBy"), false);
  assert.equal(Object.hasOwn(created, "lastLogin"), false, "lastLogin lo mantiene la autenticación");
  await repository.update(tx, "u1", updatedAt.toISOString(), { ...values, password: null, isAdmin: true } as never);
  const updated = calls.find(([kind]) => kind === "update")![1].data as Record<string, unknown>;
  assert.equal(Object.hasOwn(updated, "password"), false, "contraseña vacía conserva la guardada");
  assert.deepEqual(updated.sessionVersion, { increment: 1 }, "cambiar el rol revoca las sesiones");
  assert.equal(updated.name, "Ana");
  assert.equal(Object.hasOwn(updated, "partner"), false);
  assert.ok((updated.updatedAt as Date).getTime() > stored.updatedAt.getTime());
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
