import assert from "node:assert/strict";
import test from "node:test";
import { Fields, Model } from "../orm";
import { defineModule } from "../modules/define";
import { declareAccess } from "../access/declare";
import { composeModules } from "../modules/compose";
import { transferHeaders } from "./transfer-contract";
import { defineModel } from "../orm/model";
import { assertAdditiveEvolution } from "../orm/generator/evolution";
import { generateModule } from "../orm/generator/generate";

class Country extends Model {
  codigo = Fields.Text({ unique: true, required: true });
  name = Fields.Text({ required: true });
  active = Fields.Boolean({ default: true });
  secret = Fields.Text({ sensitive: true });
  password = Fields.Text({ writeOnly: true });
  ownerId = Fields.Many2one("User");
}
test("transfer contracts reject private/non-scalar/unknown fields, nonunique keys and unpublished outputs", () => {
  const define = (key: string, fields: string[], list?: { fields: string[] }) => defineModule({ id: "test", name: "Test", icon: "boxes", models: { country: { model: Country, transfer: { key, fields }, ...(list ? { list } : {}) } } });
  assert.ok(define("codigo", ["codigo", "name", "active"]));
  for (const field of ["secret", "password", "ownerId", "id", "revision", "unknown"]) assert.throws(() => define("codigo", ["codigo", field]), /habilitado/);
  assert.throws(() => define("name", ["name"]), /única/);
  assert.throws(() => define("codigo", ["codigo", "codigo"]), /duplicados/);
  assert.throws(() => define("codigo", ["codigo", "name"], { fields: ["codigo"] }), /habilitado/);
});

test("manifests grant import/export independently of CRUD and reject invalid booleans", () => {
  const base = { groups: { staff: "Staff" }, access: [{ group: "staff", models: "item", perms: "r", import: true, export: false }] };
  const access = declareAccess("test", base, { item: {} });
  assert.deepEqual(access.grants[0].perms, { read: true, create: false, write: false, unlink: false, import: true });
  assert.throws(() => declareAccess("test", { ...base, access: [{ ...base.access[0], export: "false" as unknown as boolean }] }, { item: {} }), /booleano/);
});

class State extends Model {
  readonly uniqueTogether = [["paisId", "codigo"]] as const;
  paisId = Fields.Many2one("TestCountry", { required: true });
  codigo = Fields.Text({ required: true });
  name = Fields.Text({ required: true });
}

test("compound transfer identity and explicit Many2one keys are validated across composed models", () => {
  const transfer = { key: ["paisId", "codigo"], fields: ["paisId", "codigo", "name"], relations: { paisId: { key: "codigo" } } };
  const definition = defineModule({ id: "test", name: "Test", icon: "boxes", models: { country: Country, state: { model: State, transfer } } });
  assert.ok(composeModules([definition]));
  assert.deepEqual(transferHeaders(transfer), ["paisId.codigo", "codigo", "name"]);
  const invalid = defineModule({ id: "test", name: "Test", icon: "boxes", models: { country: Country, state: { model: State, transfer: { ...transfer, relations: { paisId: { key: "name" } } } } } });
  assert.throws(() => composeModules([invalid]), /Text única/);
  assert.throws(() => composeModules([defineModule({ id: "test", name: "Test", icon: "boxes", models: { state: { model: State, transfer } } })]), /registrado/);
});

class Municipality extends Model {
  readonly uniqueTogether = [["estadoId", "codigo"]] as const;
  estadoId = Fields.Many2one("TestState", { required: true });
  codigo = Fields.Text({ required: true });
  name = Fields.Text({ required: true });
}

test("Many2one references accept a destination's compound key, resolved hop by hop (two at most)", () => {
  const state = { key: ["paisId", "codigo"], relations: { paisId: { key: "codigo" } } } as const;
  const transfer = { key: ["estadoId", "codigo"], fields: ["estadoId", "codigo", "name"], relations: { estadoId: state } };
  const buildModule = (municipality: object, extra: object = {}) => defineModule({ id: "test", name: "Test", icon: "boxes", models: {
    country: Country,
    state: { model: State, transfer: { key: ["paisId", "codigo"], fields: ["paisId", "codigo", "name"], relations: { paisId: { key: "codigo" } } } },
    municipality: { model: Municipality, transfer: { ...transfer, ...municipality } },
    ...extra,
  } });
  assert.ok(composeModules([buildModule({})]));
  assert.deepEqual(transferHeaders(transfer), ["estadoId.paisId.codigo", "estadoId.codigo", "codigo", "name"]);
  // The compound key must be exactly the destination's uniqueTogether group.
  assert.throws(() => composeModules([buildModule({ relations: { estadoId: { key: ["paisId", "name"], relations: { paisId: { key: "codigo" } } } } })]), /uniqueTogether/);
  // Every Many2one member needs its own nested key; scalars cannot declare one.
  assert.throws(() => composeModules([buildModule({ relations: { estadoId: { key: ["paisId", "codigo"] } } })]), /uniqueTogether/);
  assert.throws(() => composeModules([buildModule({ relations: { estadoId: { key: ["paisId", "codigo"], relations: { paisId: { key: "codigo" }, codigo: { key: "codigo" } } } } })]), /uniqueTogether/);
  // Nested hops keep the simple-key rules of their own destination.
  assert.throws(() => composeModules([buildModule({ relations: { estadoId: { key: ["paisId", "codigo"], relations: { paisId: { key: "name" } } } } })]), /Text única/);
  // A destination without that group cannot be referenced by a compound key.
  assert.throws(() => composeModules([buildModule({ relations: { estadoId: { key: "codigo" } } })]), /Text única/);
  // Nested relations must name a member of the key; at most two hops.
  assert.throws(() => buildModule({ relations: { estadoId: { key: ["paisId", "codigo"], relations: { name: { key: "codigo" } } } } }), /referencia Many2one inválida/);
  const tooDeep = { key: ["estadoId", "codigo"], relations: { estadoId: state } };
  assert.throws(() => buildModule({ relations: { estadoId: { key: ["paisId", "codigo"], relations: { paisId: tooDeep } } } }), /saltos/);
});

test("compound uniqueness only accepts required persistent fields and cannot silently disappear from generated schemas", () => {
  class Optional extends Model { readonly uniqueTogether = [["name", "code"]]; name = Fields.Text(); code = Fields.Text({ required: true }); }
  class Duplicate extends Model { readonly uniqueTogether = [["name", "name"]]; name = Fields.Text({ required: true }); }
  for (const model of [Optional, Duplicate]) assert.throws(() => defineModel(model, { name: "Invalid", table: "invalid" }), /uniqueTogether/);
  const contract = defineModel(State, { name: "State", table: "state" });
  assert.deepEqual(contract.uniqueTogether, [["paisId", "codigo"]]);
  assert.equal(Object.hasOwn(contract.createDefaults(), "uniqueTogether"), false);
  class CountryKey extends Model { codigo = Fields.Text({ unique: true, required: true }); }
  const country = defineModel(CountryKey, { name: "TestCountry", table: "test_country" });
  const files = generateModule({ id: "test", depends: [], models: [
    { model: country, clientFields: Object.keys(country.metadata) },
    { model: contract, clientFields: Object.keys(contract.metadata) },
  ] }, { schema: 'datasource db {\n provider = "postgresql"\n}\nmodel User {\n id String @id\n}\n', owners: {} });
  assert.match(files["models.prisma"], /@@unique\(\[paisId, codigo\]\)/);
  const before = 'model State {\n paisId String\n codigo String\n @@map("state")\n}';
  const after = 'model State {\n paisId String\n codigo String\n @@unique([paisId, codigo])\n @@map("state")\n}';
  assert.doesNotThrow(() => assertAdditiveEvolution(before, after));
  assert.throws(() => assertAdditiveEvolution(after, before, true), /índices/);
});
