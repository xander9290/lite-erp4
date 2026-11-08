import assert from "node:assert/strict";
import test from "node:test";
import { Fields, Model, defineModel } from "./index";
import { vehicleModel } from "./examples/fleet-vehicle";

const validVehicle = { plate: "  ABC-123  ", brand: "Marca de prueba", mileage: 0, driverId: null, active: false, state: "available", nextServiceAt: null };

test("class fields produce a strict Zod contract with nested field errors and separate empty defaults", () => {
  const defaults = vehicleModel.createDefaults();
  assert.deepEqual(defaults, { plate: "", brand: "", mileage: 0, driverId: null, active: true, state: "available", nextServiceAt: null });
  assert.notEqual(defaults, vehicleModel.createDefaults());
  defaults.plate = "Local edit";
  assert.equal(vehicleModel.createDefaults().plate, "");
  const empty = vehicleModel.schema.safeParse(vehicleModel.createDefaults());
  assert.equal(empty.success, false);
  if (!empty.success) assert.deepEqual(empty.error.issues.map(issue => issue.path), [["plate"], ["brand"]]);
  assert.equal(vehicleModel.parse(validVehicle).plate, "ABC-123");
  assert.equal(vehicleModel.parse(validVehicle).mileage, 0);
  assert.equal(vehicleModel.parse(validVehicle).active, false);
  for (const patch of [{ plate: null }, { plate: " " }, { brand: undefined }, { plate: "x".repeat(21) }, { mileage: -1 }, { mileage: 0.5 }, { mileage: "10" }, { mileage: Number.MAX_SAFE_INTEGER + 1 }, { active: "false" }, { state: "unknown" }, { driverId: { id: "partner-id" } }, { id: "injected" }, { isAdmin: true }, { save: {} }]) {
    assert.equal(vehicleModel.schema.safeParse({ ...validVehicle, ...patch }).success, false);
  }
});

test("optional scalar controls normalize empties, while required inputs reject them", () => {
  const optional = defineModel(class Optional extends Model {
    note = Fields.Text({ minLength: 3, maxLength: 10 });
    count = Fields.Integer();
    ownerId = Fields.Many2one("Partner", { onDelete: "SetNull" });
    date = Fields.DateTime();
  }, { name: "Optional", table: "optional" });
  assert.deepEqual(optional.parse({ note: "  ", count: null, ownerId: " ", date: "" }), { note: null, count: null, ownerId: null, date: null });
  assert.equal(optional.parse({ note: " text ", count: 0, ownerId: " partner-id ", date: null }).ownerId, "partner-id");
  assert.equal(optional.schema.safeParse({ note: "ab", count: null, ownerId: null, date: null }).success, false);
  const required = Fields.Many2one("Partner", { required: true });
  assert.equal(required.schema.safeParse(null).success, false);
  assert.equal(required.schema.safeParse("").success, false);
  assert.equal(Fields.Text({ trim: false }).schema.parse("  "), "  ");
});

test("datetime fields require explicit UTC instants and factories run only when requesting defaults", () => {
  let calls = 0;
  const dateField = Fields.DateTime({ required: true, default: () => { calls++; return "2026-11-07T15:30:00.000Z"; } });
  assert.equal(calls, 0);
  assert.equal(dateField.createDefault(), "2026-11-07T15:30:00.000Z");
  dateField.createDefault();
  assert.equal(calls, 2);
  for (const value of [null, "", "2026-11-07", "2026-11-07T09:30", "2026-11-07T09:30:00-06:00", "2026-02-30T15:30:00Z"]) assert.equal(dateField.schema.safeParse(value).success, false);
  const invalidFactory = Fields.Integer({ min: 0, default: () => -1 });
  assert.throws(() => invalidFactory.createDefault(), /Valor inicial inválido/);
});

test("metadata is immutable, serializable and does not expose default factories or methods", () => {
  const field = Fields.DateTime({ default: () => "2026-11-07T15:30:00Z" });
  assert.equal(field.metadata.defaultKind, "factory");
  assert.equal(Object.hasOwn(field.metadata, "defaultValue"), false);
  assert.ok(Object.isFrozen(vehicleModel));
  assert.ok(Object.isFrozen(vehicleModel.metadata));
  assert.ok(Object.isFrozen(vehicleModel.fields.plate.metadata));
  assert.equal(vehicleModel.metadata.plate.unique, true); // Metadata only: no database access here.
  assert.equal(vehicleModel.metadata.driverId.kind, "many2one");
  const metadata = JSON.parse(JSON.stringify(vehicleModel.metadata));
  assert.equal(metadata.state.choices[0].value, "available");
  assert.equal(JSON.stringify(metadata).includes("schema"), false);
  const options = { trim: true, maxLength: 8 };
  const text = Fields.Text(options);
  options.trim = false;
  assert.equal(text.schema.parse(" ok "), "ok");
});

test("invalid declarations fail early instead of silently producing different validation", () => {
  assert.throws(() => Fields.Text({ maxLength: -1 }), /límites/);
  assert.throws(() => Fields.Text({ required: true, maxLength: 0 }), /al menos un carácter/);
  assert.throws(() => Fields.Integer({ min: 10, max: 1 }), /mínimo/);
  assert.throws(() => Fields.Integer({ max: 2147483648 }), /32 bits/);
  assert.throws(() => Fields.Integer({ min: 2147483648 }), /32 bits/);
  assert.equal(Fields.Integer().schema.safeParse(2147483648).success, false);
  assert.equal(Fields.Integer().schema.safeParse(-2147483649).success, false);
  assert.throws(() => Fields.Text({ label: "" }), /label/);
  assert.throws(() => Fields.Text({ label: "Placas", ...{ maxLenght: 20 } }), /desconocida/);
  assert.throws(() => Fields.Integer({ min: 0, default: -1 }), /inicial inválido/);
  assert.throws(() => Fields.Many2one("partner"), /modelo/);
  assert.throws(() => Fields.Many2one("Partner", { required: true, onDelete: "SetNull" }), /borrado/);
  assert.throws(() => Fields.Selection([{ value: "a", label: "A" }, { value: "a", label: "Otro" }]), /únicos/);
  // @ts-expect-error Malformed JavaScript declarations must fail before producing metadata.
  assert.throws(() => Fields.Selection([{ value: undefined, label: "A" }]), /identificadores válidos/);
  // @ts-expect-error Also reject invalid JavaScript declarations at runtime.
  assert.throws(() => Fields.Selection([{ value: "a", label: "A" }], { default: "b" }), /inicial inválido/);
  assert.throws(() => defineModel(class Empty extends Model {}, { name: "Empty", table: "empty" }), /al menos un Field/);
  assert.throws(() => defineModel(class Bad extends Model { plate = "raw string"; }, { name: "Bad", table: "bad" }), /mediante Fields/);
  assert.throws(() => defineModel(class Bad extends Model { id = Fields.Text(); }, { name: "Bad", table: "bad" }), /reservado/);
  assert.throws(() => defineModel(class Bad extends Model { plate = Fields.Text(); }, { name: "bad", table: "bad" }), /PascalCase/);
});

test("inherited field declarations are collected and instance methods stay outside submitted data", () => {
  class Base extends Model { active = Fields.Boolean(); }
  class Extended extends Base {
    name = Fields.Text({ required: true });
    helper() { return "Server business method, not a field"; }
  }
  const model = defineModel(Extended, { name: "Extended", table: "extended" });
  assert.deepEqual(Object.keys(model.fields), ["active", "name"]);
  assert.equal(model.parse({ active: false, name: "Registro" }).active, false);
  const refined = model.schema.superRefine((values, context) => {
    if (values.active && values.name === "Bloqueado") context.addIssue({ code: "custom", path: ["name"], message: "Este nombre no puede activarse." });
  });
  assert.equal(refined.safeParse({ active: true, name: "Bloqueado" }).success, false);
  assert.equal(model.schema.safeParse({ active: false, name: "Registro", helper: "injected" }).success, false);
});
