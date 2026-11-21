import "server-only";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { Readable } from "node:stream";
import { z } from "zod";
import type { TransferFile, TransferFormat } from "./transfer-types";

export const MAX_IMPORT_BYTES = 512_000;
export const MAX_IMPORT_ROWS = 200;
export class TransferInputError extends Error {}
const MAX_EXPANDED_BYTES = 8_000_000;
const formula = /^[\s\u0000-\u001f]*[=+@-]/;

/** CSV with quoting/newlines; malformed quotes fail instead of shifting cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [], row: string[] = [];
  let cell = "", quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else cell += char;
    } else if (char === "," || char === "\n" || char === "\r") {
      row.push(cell); cell = ""; closed = false;
      if (char !== ",") { rows.push([...row]); row.length = 0; if (char === "\r" && text[i + 1] === "\n") i++; }
    } else if (char === '"' && !cell && !closed) quoted = true;
    else { if (char === '"' || closed) throw new TransferInputError("CSV con comillas inválidas."); cell += char; }
    if (rows.length > MAX_IMPORT_ROWS + 1 || row.length > 12 || cell.length > 16_000) throw new TransferInputError("El archivo supera los límites de importación.");
  }
  if (quoted) throw new TransferInputError("CSV con comillas sin cerrar.");
  if (row.length || cell || closed) rows.push([...row, cell]);
  return rows;
}

/** Bound expanded XML before ExcelJS loads it (including dishonest ZIP size headers). */
async function checkArchive(bytes: Buffer) {
  const zip = await JSZip.loadAsync(bytes);
  const files = Object.values(zip.files).filter(file => !file.dir);
  if (files.length > 128) throw new TransferInputError("El Excel contiene demasiados archivos internos.");
  let total = 0;
  for (const file of files) {
    const stream = new Readable().wrap(file.nodeStream());
    for await (const chunk of stream) {
      total += (chunk as Buffer).length;
      if (total > MAX_EXPANDED_BYTES) throw new TransferInputError("El Excel descomprimido supera 8 MB.");
    }
  }
}

export async function readTransferFile(name: string, bytes: Buffer): Promise<unknown[][]> {
  if (!bytes.length || bytes.length > MAX_IMPORT_BYTES) throw new TransferInputError("El archivo debe tener contenido y pesar como máximo 512 KB.");
  let rows: unknown[][];
  if (/\.csv$/i.test(name)) rows = parseCsv(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  else if (/\.xlsx$/i.test(name)) {
    await checkArchive(bytes);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    // Editors can serialize hundreds of empty/formatted rows and columns. Measure
    // cell content before enforcing bounds; retain internal gaps and row numbers.
    const sheets = workbook.worksheets.map(sheet => {
      let rowCount = 0, columnCount = 0;
      sheet.eachRow(row => row.eachCell((cell, column) => {
        if (cell.value === null || cell.value === undefined || cell.value === "") return;
        rowCount = Math.max(rowCount, row.number);
        columnCount = Math.max(columnCount, column);
      }));
      return { sheet, rowCount, columnCount };
    }).filter(({ rowCount }) => rowCount > 0);
    if (sheets.length !== 1) throw new TransferInputError("Usa una sola hoja de datos con encabezados.");
    const { sheet, rowCount, columnCount } = sheets[0];
    if (rowCount > MAX_IMPORT_ROWS + 1 || columnCount > 12) throw new TransferInputError("Máximo 200 filas de datos y 12 columnas.");
    rows = Array.from({ length: rowCount }, (_, index) => {
      const row = sheet.getRow(index + 1);
      return Array.from({ length: columnCount }, (_, column) => row.getCell(column + 1).value);
    });
  } else throw new TransferInputError("Selecciona un archivo .xlsx o .csv UTF-8.");
  while (rows.length && rows.at(-1)!.every(cell => cell === null || cell === "")) rows.pop();
  if (rows.length < 2 || rows.length > MAX_IMPORT_ROWS + 1) throw new TransferInputError("Incluye encabezados y entre 1 y 200 filas de datos.");
  return rows;
}

export function cellValue(value: unknown, kind: string): unknown {
  if (kind === "datetime") {
    if (value === null || value === "") return null;
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
    if (typeof value === "string") {
      if (z.iso.date().safeParse(value).success) return `${value}T00:00:00.000Z`;
      if (z.iso.datetime({ offset: true }).safeParse(value).success) return new Date(value).toISOString();
    }
    throw new TransferInputError("Usa YYYY-MM-DD o una fecha y hora ISO con Z o desfase horario explícito.");
  }
  if (value !== null && typeof value === "object") throw new TransferInputError("No se admiten fórmulas, enlaces, errores ni objetos de Excel.");
  if (typeof value === "string" && formula.test(value) && !(kind === "integer" && /^-?\d+$/.test(value))) throw new TransferInputError("No se admiten fórmulas ni texto que Excel interprete como fórmula.");
  if (kind === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new TransferInputError("Usa true o false.");
  }
  if (kind === "integer") {
    if (typeof value === "number" && Number.isSafeInteger(value)) return value;
    if (typeof value === "string" && /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value))) return Number(value);
    if (value === null || value === "") return null;
    throw new TransferInputError("Introduce un entero válido.");
  }
  if (value === null || value === "") return "";
  if (typeof value !== "string") throw new TransferInputError("Define esta celda como texto para conservar códigos y ceros iniciales.");
  return value;
}

export async function writeTransferFile(format: TransferFormat, fields: readonly string[], rows: readonly Record<string, unknown>[], name: string): Promise<TransferFile> {
  if (format === "csv") {
    const escape = (value: unknown) => {
      let text = value == null ? "" : String(value);
      if (typeof value === "string" && formula.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const text = "\uFEFF" + [fields, ...rows.map(row => fields.map(field => row[field]))].map(row => row.map(escape).join(",")).join("\r\n") + "\r\n";
    return { name: `${name}.csv`, mime: "text/csv;charset=utf-8", base64: Buffer.from(text).toString("base64") };
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Datos");
  sheet.columns = fields.map(field => ({ header: field, key: field, width: field === "name" ? 40 : 22 }));
  for (const row of rows) sheet.addRow(fields.map(field => row[field] == null ? "" : row[field] as string | number | boolean));
  fields.forEach((_, index) => { sheet.getColumn(index + 1).numFmt = "@"; });
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return { name: `${name}.xlsx`, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64") };
}
