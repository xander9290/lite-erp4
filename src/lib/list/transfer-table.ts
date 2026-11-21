import { cellValue } from "./transfer-file";
import { transferColumns, transferKeyFields, type TransferSpec } from "./transfer-contract";
import { ModelValidationError } from "../orm/context";

export type TransferInputRow = { row: number; raw: Record<string, unknown>; errors: Record<string, string> };
const blank = (value: unknown) => value === null || value === undefined || value === "";

export function validateTransferHeaders(spec: TransferSpec, headers: unknown[], prefix = "") {
  const columns = transferColumns(spec), allowed = columns.map(column => prefix + column.header);
  const keys = transferKeyFields(spec);
  const required = columns.filter(column => !column.document?.length && keys.includes(column.field)).map(column => prefix + column.header);
  if ((!prefix && (headers.some(header => typeof header !== "string" || !allowed.includes(header)) || new Set(headers).size !== headers.length)) || required.some(header => !headers.includes(header))) throw new ModelValidationError(`Encabezados válidos: ${allowed.join(", ")}; incluye ${required.join(", ")}, sin duplicados.`);
  for (const field of Object.keys(spec.relations ?? {})) {
    const group = columns.filter(column => !column.document?.length && column.field === field).map(column => prefix + column.header);
    if (group.some(header => headers.includes(header)) && !group.every(header => headers.includes(header))) throw new ModelValidationError(`Incluye juntas las columnas de la referencia: ${group.join(", ")}.`);
  }
  for (const [field, child] of Object.entries(spec.lines ?? {})) {
    const childPrefix = `${prefix}${field}.`;
    if (headers.some(header => typeof header === "string" && header.startsWith(childPrefix))) validateTransferHeaders(child, headers, childPrefix);
  }
}

/** A repeated parent is one document. Every repeated scalar must agree: no last-row wins. */
export function groupTransferRows(table: unknown[][], spec: TransferSpec, kinds: ReadonlyMap<string, string>): TransferInputRow[] {
  const headers = table[0] as string[], columns = transferColumns(spec);
  type Flat = { row: number; cells: Record<string, unknown>; errors: Record<string, string> };
  const flat: Flat[] = table.slice(1).map((cells, index) => {
    const row: Flat = { row: index + 2, cells: {}, errors: {} };
    if (cells.slice(headers.length).some(cell => !blank(cell))) row.errors[""] = "La fila contiene más celdas que encabezados.";
    headers.forEach((header, i) => {
      const column = columns.find(column => column.header === header)!;
      // Blank line cells mean no child at this physical row, including Boolean fields.
      if (column.document?.length && blank(cells[i])) { row.cells[header] = ""; return; }
      try { row.cells[header] = cellValue(cells[i] ?? null, kinds.get(header)!); }
      catch (error) { row.errors[header] = `Fila ${row.row}: ${(error as Error).message}`; }
    });
    return row;
  });
  function group(rows: Flat[], current: TransferSpec, prefix = ""): TransferInputRow[] {
    const currentColumns = transferColumns(current).filter(column => !column.document?.length);
    const line = Object.entries(current.lines ?? {})[0];
    const keys = transferKeyFields(current);
    const keyHeaders = currentColumns.filter(column => keys.includes(column.field)).map(column => column.header);
    const groups = new Map<string, Flat[]>();
    for (const row of rows) {
      const key = line ? JSON.stringify(keyHeaders.map(header => row.cells[prefix + header])) : String(row.row);
      const group = groups.get(key);
      if (group) group.push(row); else groups.set(key, [row]);
    }
    return [...groups.values()].map(rows => {
      const raw: Record<string, unknown> = {}, errors = Object.assign({}, ...rows.map(row => row.errors));
      const first = rows[0];
      for (const column of currentColumns) {
        const header = prefix + column.header;
        if (!headers.includes(header)) continue;
        let value = first.cells[header];
        if (rows.some(row => JSON.stringify(row.cells[header]) !== JSON.stringify(value))) errors[header] = `El valor del padre debe coincidir en todas sus filas (desde fila ${first.row}).`;
        // A wholly blank branch was skipped above. Within a real line, blanks use the
        // same conversions as root fields (nullable integers/dates, strict Booleans).
        if (blank(value)) {
          try { value = cellValue(value ?? null, kinds.get(header)!); }
          catch (error) { errors[header] = `Fila ${first.row}: ${(error as Error).message}`; }
        }
        if (!column.path.length) raw[column.field] = value;
        else ((raw[column.field] ??= {}) as Record<string, unknown>)[column.path.join(".")] = value;
      }
      if (line) {
        const [field, child] = line, childPrefix = `${prefix}${field}.`;
        const childHeaders = headers.filter(header => header.startsWith(childPrefix));
        if (childHeaders.length) {
          const children = group(rows.filter(row => childHeaders.some(header => !blank(row.cells[header]))), child, childPrefix);
          raw[field] = children.map(row => row.raw);
          for (const row of children) Object.assign(errors, row.errors);
        }
      }
      return { row: first.row, raw, errors };
    });
  }
  return group(flat, spec);
}

/** Encode one complete authorized document as ordinary rows, repeating its parent fields. */
export function flattenTransferDocument(spec: TransferSpec, values: Record<string, unknown>, prefix = ""): Record<string, unknown>[] {
  const line = Object.entries(spec.lines ?? {})[0];
  const scalar = Object.fromEntries(Object.entries(values).filter(([field]) => field !== line?.[0]).map(([field, value]) => [prefix + field, value]));
  if (!line) return [scalar];
  const [field, child] = line;
  const rows = values[field] as Record<string, unknown>[];
  return rows.length ? rows.flatMap(row => flattenTransferDocument(child, row, `${prefix}${field}.`).map(row => ({ ...scalar, ...row }))) : [scalar];
}
