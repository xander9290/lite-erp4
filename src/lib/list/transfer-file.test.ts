import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { cellValue, parseCsv, readTransferFile, writeTransferFile } from "./transfer-file";

test("CSV preserves quotes/newlines, BOM, codes and rejects malformed data", () => {
  assert.deepEqual(parseCsv('\uFEFFcodigo,name\r\nMX,"México, \"\"oficial\"\"\nNorte"\r\n'), [["codigo", "name"], ["MX", 'México, "oficial"\nNorte']]);
  for (const csv of ['name\n"sin cerrar', 'name\n"texto"otro', 'name\ntex"to']) assert.throws(() => parseCsv(csv), /comillas/);
  assert.equal(cellValue("001", "text"), "001");
  assert.throws(() => cellValue(1, "text"), /texto/);
  for (const input of ["=SUM(A1:A2)", " @SUM(A1)", "+cmd", { formula: "1+1", result: 2 }]) assert.throws(() => cellValue(input, "text"), /fórmula/);
  assert.equal(cellValue("false", "boolean"), false);
  assert.equal(cellValue(true, "boolean"), true);
  assert.throws(() => cellValue("sí", "boolean"), /true o false/);
  assert.equal(cellValue("-10", "integer"), -10);
});

test("XLSX and CSV roundtrip Unicode, text codes and booleans; export neutralizes CSV formulas", async () => {
  for (const format of ["csv", "xlsx"] as const) {
    const file = await writeTransferFile(format, ["codigo", "name", "active"], [{ codigo: "MX", name: 'México, "oficial"', active: false }], "pais");
    const rows = await readTransferFile(file.name, Buffer.from(file.base64, "base64"));
    assert.deepEqual(rows[0], ["codigo", "name", "active"]);
    assert.equal(rows[1][0], "MX");
    assert.equal(rows[1][1], 'México, "oficial"');
    assert.equal(cellValue(rows[1][2], "boolean"), false);
  }
  const csv = await writeTransferFile("csv", ["name"], [{ name: "=HYPERLINK(\"bad\")" }], "test");
  assert.match(Buffer.from(csv.base64, "base64").toString(), /'=HYPERLINK/);
});

test("Excel formulas, excessive rows/sheets, formats and expanded ZIP data cannot enter imports", async () => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Datos"); sheet.addRow(["name"]); sheet.addRow([{ formula: "1+1", result: 2 }]);
  const rows = await readTransferFile("pais.xlsx", Buffer.from(await wb.xlsx.writeBuffer()));
  assert.throws(() => cellValue(rows[1][0], "text"), /fórmulas/);
  wb.addWorksheet("Otra").addRow(["name"]);
  await assert.rejects(readTransferFile("pais.xlsx", Buffer.from(await wb.xlsx.writeBuffer())), /una sola hoja/);
  await assert.rejects(readTransferFile("pais.csv", Buffer.from("codigo\n" + "MX\n".repeat(201))), /límites|200/);
  await assert.rejects(readTransferFile("pais.xls", Buffer.from("data")), /xlsx/);
  const zip = new JSZip(); zip.file("huge.xml", "a".repeat(8_000_001));
  await assert.rejects(readTransferFile("bomb.xlsx", await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })), /8 MB/);
});
