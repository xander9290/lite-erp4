import assert from "node:assert/strict";
import test from "node:test";
import { flattenTransferDocument, groupTransferRows, validateTransferHeaders } from "./transfer-table";
import { transferHeaders, type TransferSpec } from "./transfer-contract";

const spec: TransferSpec = {
  key: "codigo", fields: ["codigo", "name", "lineas"],
  lines: { lineas: { key: "codigo", fields: ["codigo", "cantidad", "entregas"], mode: "merge",
    lines: { entregas: { key: "codigo", fields: ["codigo", "cantidad"], mode: "merge" } },
  } },
};
const headers = transferHeaders(spec);
const kinds = new Map(headers.map(header => [header, header.endsWith("cantidad") ? "integer" : "text"]));

test("flat rows group nested lines by business identity, retaining independent documents and leading zeros", () => {
  const rows = groupTransferRows([ [...headers],
    ["01", "Primero", "A", 2, "E1", 1],
    ["01", "Primero", "A", 2, "E2", 1],
    ["01", "Primero", "B", 3, "", ""],
    ["02", "Segundo", "C", 4, "", ""],
  ], spec, kinds);
  assert.deepEqual(rows, [
    { row: 2, errors: {}, raw: { codigo: "01", name: "Primero", lineas: [
      { codigo: "A", cantidad: 2, entregas: [{ codigo: "E1", cantidad: 1 }, { codigo: "E2", cantidad: 1 }] },
      { codigo: "B", cantidad: 3, entregas: [] },
    ] } },
    { row: 5, errors: {}, raw: { codigo: "02", name: "Segundo", lineas: [{ codigo: "C", cantidad: 4, entregas: [] }] } },
  ]);
  const output = rows.flatMap(row => flattenTransferDocument(spec, row.raw));
  assert.deepEqual(groupTransferRows([[...headers], ...output.map(row => headers.map(header => row[header] ?? ""))], spec, kinds).map(row => row.raw), rows.map(row => row.raw));
});

test("conflicting repeated parents, malformed children and partial compound references reject the document", () => {
  const rows = groupTransferRows([[...headers], ["01", "Uno", "A", 2, "E", "no entero"], ["01", "Otro", "B", 3, "", ""]], spec, kinds);
  assert.match(rows[0].errors.name, /coincidir/);
  assert.match(rows[0].errors["lineas.entregas.cantidad"], /Fila 2/);
  assert.throws(() => validateTransferHeaders(spec, ["codigo", "lineas.cantidad"]), /lineas.codigo/);
  const relation: TransferSpec = { key: "codigo", fields: ["codigo", "destinoId"], relations: { destinoId: { key: ["paisId", "codigo"], relations: { paisId: { key: "codigo" } } } } };
  assert.throws(() => validateTransferHeaders(relation, ["codigo", "destinoId.codigo"]), /juntas/);
  assert.throws(() => validateTransferHeaders(spec, ["codigo", "id"]), /Encabezados/);
});

test("omitted child columns stay omitted; blank children do not create lines or remove existing ones", () => {
  assert.deepEqual(groupTransferRows([["codigo", "name"], ["01", "Uno"]], spec, kinds)[0].raw, { codigo: "01", name: "Uno" });
  assert.deepEqual(groupTransferRows([[...headers], ["01", "Uno", "", "", "", ""]], spec, kinds)[0].raw, { codigo: "01", name: "Uno", lineas: [] });
  const scalar: TransferSpec = { key: "codigo", fields: ["codigo"] };
  assert.equal(groupTransferRows([["codigo"], ["01"], ["01"]], scalar, kinds).length, 2, "ordinary duplicate keys remain separate errors in review");
});

test("blank optional integers and dates inside a real line become null; blank Booleans remain invalid", () => {
  const spec: TransferSpec = { key: "codigo", fields: ["codigo", "lineas"], lines: { lineas: { key: "codigo", mode: "merge", fields: ["codigo", "fecha", "cantidad", "active"] } } };
  const headers = transferHeaders(spec);
  const kinds = new Map([["codigo", "text"], ["lineas.codigo", "text"], ["lineas.fecha", "datetime"], ["lineas.cantidad", "integer"], ["lineas.active", "boolean"]]);
  const [valid] = groupTransferRows([[...headers], ["P1", "L1", "", "", false]], spec, kinds);
  assert.deepEqual(valid.errors, {});
  assert.deepEqual(valid.raw.lineas, [{ codigo: "L1", fecha: null, cantidad: null, active: false }]);
  const [invalid] = groupTransferRows([[...headers], ["P1", "L1", "", "", ""]], spec, kinds);
  assert.match(invalid.errors["lineas.active"], /true o false/);
});
