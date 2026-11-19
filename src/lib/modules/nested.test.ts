import assert from "node:assert/strict";
import { test } from "node:test";
import { Fields, Model } from "../orm";
import { defineModule } from "./define";
import { countDocumentRows, MAX_DOCUMENT_ROWS, type LineRelations } from "../orm/one2many";

class Pedido extends Model {
  name = Fields.Text({ label: "Pedido", required: true });
  lineas = Fields.One2many("AnidPartida", { inverse: "pedidoId", label: "Partidas", maxRows: 20 });
}
class Partida extends Model {
  name = Fields.Text({ label: "Producto", required: true });
  pedidoId = Fields.Many2one("AnidPedido", { required: true });
  entregas = Fields.One2many("AnidEntrega", { inverse: "partidaId", label: "Entregas", maxRows: 10 });
}
class Entrega extends Model {
  cantidad = Fields.Integer({ label: "Cantidad", required: true, min: 1, default: 1 });
  partidaId = Fields.Many2one("AnidPartida", { required: true });
}

test("lines nest up to three levels: document → line → sub-line", () => {
  const definition = defineModule({ id: "anid", name: "Anidados", icon: "list", models: { pedido: Pedido, partida: Partida, entrega: Entrega } });
  const partida = definition.models.find(model => model.key === "partida")!;
  assert.deepEqual(Object.keys(partida.contract.one2manyFields), ["entregas"]);
});

test("a fourth level and cycles are rejected", () => {
  class Detalle extends Model {
    nota = Fields.Text({ label: "Nota" });
    entregaId = Fields.Many2one("AnidEntrega", { required: true });
  }
  class EntregaConDetalle extends Model {
    cantidad = Fields.Integer({ label: "Cantidad", required: true, default: 1 });
    partidaId = Fields.Many2one("AnidPartida", { required: true });
    detalles = Fields.One2many("AnidDetalle", { inverse: "entregaId" });
  }
  assert.throws(() => defineModule({ id: "anid", name: "Anidados", icon: "list", models: { pedido: Pedido, partida: Partida, entrega: EntregaConDetalle, detalle: Detalle } }), /hasta 3 niveles/);
  class A extends Model { name = Fields.Text({ label: "A" }); bId = Fields.Many2one("CicloB", { required: true }); bs = Fields.One2many("CicloB", { inverse: "aId" }); }
  class B extends Model { name = Fields.Text({ label: "B" }); aId = Fields.Many2one("CicloA", { required: true }); as = Fields.One2many("CicloA", { inverse: "bId" }); }
  assert.throws(() => defineModule({ id: "ciclo", name: "Ciclo", icon: "list", models: { a: A, b: B } }), /forman un ciclo/);
});

test("the whole submitted tree is counted against the document limit", () => {
  const entregas: LineRelations = {};
  const partidas: LineRelations = { entregas: { metadata: { target: "E", inverse: "partidaId", minRows: 0, maxRows: 10 }, child: () => ({ lines: entregas }) as never } };
  const relations: LineRelations = { lineas: { metadata: { target: "P", inverse: "pedidoId", minRows: 0, maxRows: 20 }, child: () => ({ lines: partidas }) as never } };
  const tree = { lineas: [{ name: "a", entregas: [{}, {}, {}] }, { name: "b", entregas: [{}] }] };
  assert.equal(countDocumentRows(tree, relations), 6);
  assert.equal(MAX_DOCUMENT_ROWS, 500);
});

test("read-only relations are presented, never part of the document", () => {
  class Estado extends Model {
    name = Fields.Text({ label: "Estado", required: true });
    municipioIds = Fields.One2many("CatMunicipio", { inverse: "estadoId", label: "Municipios", readonly: true });
  }
  class Municipio extends Model {
    name = Fields.Text({ label: "Municipio", required: true });
    estadoId = Fields.Many2one("CatEstado", { required: true });
  }
  const definition = defineModule({ id: "cat", name: "Catálogo", icon: "map", models: { estado: Estado, municipio: Municipio } });
  const estado = definition.models.find(model => model.key === "estado")!;
  assert.deepEqual(estado.contract.childCollections, { municipioIds: { target: "CatMunicipio", inverse: "estadoId", label: "Municipios" } });
  assert.deepEqual(Object.keys(estado.contract.one2manyFields), [], "no es una línea editable");
  assert.equal(Object.hasOwn(estado.contract.createDefaults() as object, "municipioIds"), false, "no forma parte del formulario editable");
  assert.throws(() => estado.contract.normalize({ name: "x", municipioIds: [] }), /sólo acepta campos declarados/);
  assert.throws(() => Fields.One2many("CatMunicipio", { inverse: "estadoId", readonly: true, maxRows: 10 } as never), /no admite minRows\/maxRows/);
  class Mal extends Model { name = Fields.Text({ label: "X" }); otros = Fields.One2many("CatMunicipio", { inverse: "estadoId", readonly: true }); }
  assert.throws(() => defineModule({ id: "cat", name: "C", icon: "map", models: { estado: Estado, municipio: Municipio, mal: Mal } }), /relación de consulta requiere/);
});
