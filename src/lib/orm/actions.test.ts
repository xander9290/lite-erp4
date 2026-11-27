import assert from "node:assert/strict";
import { test } from "node:test";
import { Fields, Model, ModelValidationError, action, defineModel, type ActionRecord } from "./index";
import { unavailableEnvironment } from "./environment";

class Pedido extends Model {
  name = Fields.Text({ required: true });
  estado = Fields.Selection([{ value: "borrador", label: "Borrador" }, { value: "confirmado", label: "Confirmado" }], { required: true, default: "borrador" });

  @action({ label: "Confirmar" })
  confirmar(record: ActionRecord<Pedido>) {
    if (record.estado !== "borrador") throw new ModelValidationError("Sólo se confirman pedidos en borrador.");
    return { estado: "confirmado" as const };
  }
  @action({ label: "Revisar", groups: ["responsable", "ventas.gerente"] })
  revisar() { /* no changes */ }
  @action({ label: "Romper" })
  romper() { return { inventado: 1 }; }
  auxiliar() { return { estado: "confirmado" }; }
}
const context = { tx: {} as never, actor: { id: "u1", sessionVersion: 0 }, action: "x", env: unavailableEnvironment };
const pedido = defineModel(Pedido, { name: "Pedido", table: "pedido" });

test("sólo los métodos con @action se publican, con label y grupos", () => {
  assert.deepEqual(pedido.actions, [
    { name: "confirmar", label: "Confirmar" },
    { name: "revisar", label: "Revisar", groups: ["responsable", "ventas.gerente"] },
    { name: "romper", label: "Romper" },
  ]);
});

test("runAction devuelve el patch validado y rechaza lo no publicado", async () => {
  const record = { id: "p1", revision: "2026-11-14T00:00:00.000Z", name: "A", estado: "borrador" };
  assert.deepEqual(await pedido.runAction("confirmar", record, context), { estado: "confirmado" });
  assert.deepEqual(await pedido.runAction("revisar", record, context), {});
  await assert.rejects(pedido.runAction("confirmar", { ...record, estado: "confirmado" }, context), /Sólo se confirman/);
  for (const name of ["auxiliar", "normalize", "beforeSave", "constructor", "Confirmar"]) await assert.rejects(pedido.runAction(name, record, context), /no está publicada/, name);
  await assert.rejects(pedido.runAction("romper", record, context), /no es un campo declarado/);
});

test("el método recibe el registro congelado", async () => {
  class Mutador extends Model {
    name = Fields.Text();
    @action({ label: "Mutar" }) mutar(record: ActionRecord<Mutador>) { (record as { name: string }).name = "x"; }
  }
  const model = defineModel(Mutador, { name: "Mutador", table: "mutador" });
  await assert.rejects(model.runAction("mutar", { id: "1", revision: "r", name: "a" }, context), TypeError);
});

test("declaraciones inválidas fallan al definir el modelo", () => {
  class SinLabel extends Model { name = Fields.Text(); @action({ label: " " }) a() {} }
  assert.throws(() => defineModel(SinLabel, { name: "SinLabel", table: "sin_label" }), /necesita label/);
  class Reservado extends Model { name = Fields.Text(); @action({ label: "N" }) normalize(values: Readonly<Record<string, unknown>>) { return values; } }
  assert.throws(() => defineModel(Reservado, { name: "Reservado", table: "reservado" }), /reservado/);
  class GruposMal extends Model { name = Fields.Text(); @action({ label: "G", groups: [] }) g() {} }
  assert.throws(() => defineModel(GruposMal, { name: "GruposMal", table: "grupos_mal" }), /groups/);
});
