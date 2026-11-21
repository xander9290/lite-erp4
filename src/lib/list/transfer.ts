import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { AccessError } from "../auth/policy";
import { assertTransferElementAccess } from "./transfer-relations";
import { authorizeModel, modelPerms, userGroups } from "../access/engine";
import { ModelValidationError, type ModelActor } from "../orm/context";
import { transferColumns, transferHeaders, transferKeyFields } from "./transfer-contract";
import { assertTransferIdentity, decodeTransferReferences, encodeTransferValues, normalizeTransferDraft, prepareTransferDocument, transferColumnKinds, transferIdentity, type TransferReferenceCache } from "./transfer-relations";
import { flattenTransferDocument, groupTransferRows, validateTransferHeaders } from "./transfer-table";
import { getModuleModel, modelService } from "../modules/registry";
import { listStateSchema } from "./query";
import { readTransferFile, writeTransferFile } from "./transfer-file";
import type { TransferFormat, TransferPlan, TransferRow } from "./transfer-types";

// Plans expire on restart as well as after 15 minutes; no private configuration added.
const signingKey = randomBytes(32);
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
type Reviewed = { row: number; key: string; identity: Record<string, unknown>; references: string; values: Record<string, unknown>; baseline: string; expected: string; operation: "create" | "update" | "unchanged" };
type Ticket = { actor: string; version: number; model: string; contract: string; expires: number; rows: Reviewed[] };

export function transferContract(model: string) {
  const found = getModuleModel(model);
  const spec = found?.entry.declaration.transfer;
  if (!found || !spec) throw new ModelValidationError("Este modelo no habilita importación/exportación.");
  const { entry } = found;
  return { entry, spec, service: modelService(model), fingerprint: digest({ spec, metadata: entry.metadata, uniqueTogether: entry.contract.uniqueTogether, lines: entry.contract.one2manyFields, many: entry.contract.many2manyFields, implementation: entry.declaration.model.toString() }) };
}

/** Transfer grants never replace CRUD or record rules. Revalidated in each transaction. */
export async function authorizeTransfer(tx: Prisma.TransactionClient, actor: ModelActor, model: string, operation: "import" | "export") {
  await authorizeModel(tx, actor, model, "read");
  const { entry, spec } = transferContract(model);
  await assertTransferElementAccess(tx, actor, entry, spec, operation);
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { isAdmin: true } });
  if (!user?.isAdmin && !(await modelPerms(tx, await userGroups(tx, actor.id), model))[operation]) throw new AccessError("DENIED");
}

function sign(ticket: Ticket) {
  const payload = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  const token = `${payload}.${createHmac("sha256", signingKey).update(payload).digest("base64url")}`;
  if (token.length > 750_000) throw new ModelValidationError("El plan es demasiado grande; divide el archivo en lotes menores.");
  return token;
}
function unsign(token: string): Ticket {
  if (typeof token !== "string" || token.length > 750_000) throw new ModelValidationError("Plan inválido; vuelve a revisar el archivo.");
  const parts = token.split(".");
  const expected = createHmac("sha256", signingKey).update(parts[0]).digest();
  const actual = Buffer.from(parts[1] ?? "", "base64url");
  if (parts.length !== 2 || expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new ModelValidationError("El plan no está vigente; vuelve a revisar el archivo.");
  return JSON.parse(Buffer.from(parts[0], "base64url").toString()) as Ticket;
}
function errorsFor(error: unknown): Record<string, string> {
  if (error instanceof z.ZodError) return Object.fromEntries(error.issues.map(issue => [issue.path.join("."), issue.message]));
  if (error instanceof ModelValidationError) return error.fieldErrors ?? { "": error.message };
  if (error instanceof AccessError) return { "": error.message };
  return { "": "No se pudo validar esta fila con los datos y permisos actuales." };
}
class PreviewRollback extends Error {
  constructor(readonly record: Reviewed, readonly display: Record<string, unknown>) { super("PREVIEW_ROLLBACK"); }
}
class BatchValidationError extends ModelValidationError {
  constructor(readonly row: number, readonly detail: string) { super(`Fila ${row}: ${detail} No se aplicó ninguna fila.`); }
}
class BatchPreviewRollback extends Error {
  constructor(readonly result: { created: number; updated: number; unchanged: number }) { super("BATCH_PREVIEW_ROLLBACK"); }
}

export async function reviewTransfer(prisma: PrismaClient, actor: ModelActor, model: string, name: string, bytes: Buffer): Promise<TransferPlan> {
  const { entry, spec, service, fingerprint } = transferContract(model);
  await prisma.$transaction(tx => authorizeTransfer(tx, actor, model, "import"));
  const table = await readTransferFile(name, bytes);
  const columns = transferColumns(spec), keys = transferKeyFields(spec);
  const requiredHeaders = columns.filter(column => !column.document?.length && keys.includes(column.field)).map(column => column.header);
  validateTransferHeaders(spec, table[0]);
  const kinds = transferColumnKinds(entry, spec);
  const rows: TransferRow[] = [], reviewed: Reviewed[] = [], seen = new Map<string, TransferRow>();
  for (const { row: rowNumber, raw, errors } of groupTransferRows(table, spec, kinds)) {
    const row: TransferRow = { row: rowNumber, key: "", operation: "error" };
    rows.push(row);
    if (Object.keys(errors).length) { row.errors = errors; continue; }
    try {
      await prisma.$transaction(async tx => {
        await authorizeTransfer(tx, actor, model, "import");
        const decoded = await decodeTransferReferences(tx, actor, entry, spec, raw);
        const normalized = normalizeTransferDraft(entry, decoded);
        const identity = transferIdentity(entry, spec, normalized);
        if (keys.some(key => identity[key] === null || identity[key] === undefined || identity[key] === "")) throw new ModelValidationError("La clave de importación está incompleta.");
        const current = await service.findUniqueInTransaction(tx, actor, spec.key, typeof spec.key === "string" ? identity[spec.key] : identity);
        const input = await prepareTransferDocument(tx, actor, entry, spec, { ...decoded, ...identity }, current);
        const before = await encodeTransferValues(tx, actor, entry, spec, input);
        row.key = requiredHeaders.map(header => String(before.values[header])).join(" · ");
        const signature = digest(identity);
        if (seen.has(signature)) {
          const duplicate = { [requiredHeaders.join(" + ")]: "Clave repetida en el archivo después de normalizar." };
          const previous = seen.get(signature)!; previous.operation = "error"; previous.errors = duplicate;
          throw new ModelValidationError("Clave repetida.", duplicate);
        }
        seen.set(signature, row);
        // Exercise the full pipeline and always roll back the preview, including owner revisions.
        const prepared = await service.transaction.persist(tx, actor, input);
        assertTransferIdentity(entry, spec, input, prepared);
        const display = await encodeTransferValues(tx, actor, entry, spec, prepared, true);
        const changed = !current || digest(display.values) !== digest((await encodeTransferValues(tx, actor, entry, spec, current)).values);
        const operation = !current ? "create" : changed ? "update" : "unchanged";
        throw new PreviewRollback({ row: row.row, key: row.key, identity, references: digest(before.references), values: raw, baseline: digest(current), expected: digest(display.values), operation }, display.values);
      }, { isolationLevel: "RepeatableRead", timeout: 15_000 });
    } catch (error) {
      if (error instanceof PreviewRollback) { row.operation = error.record.operation; row.values = error.display; reviewed.push(error.record); }
      else row.errors = errorsFor(error);
    }
  }
  const valid = !rows.some(row => row.operation === "error");
  if (!valid) return { rows };
  const token = sign({ actor: actor.id, version: actor.sessionVersion, model, contract: fingerprint, expires: Date.now() + 15 * 60_000, rows: reviewed });
  // Per-row validation cannot see limits/constraints accumulated by other rows.
  // Exercise the same complete batch as confirmation, but always roll it back.
  try { await applyTransfer(prisma, actor, model, token, true); }
  catch (error) {
    if (!(error instanceof BatchValidationError)) throw error;
    const row = rows.find(row => row.row === error.row);
    if (!row) throw error;
    row.operation = "error"; row.errors = { "": error.detail };
    return { rows };
  }
  return { rows, token };
}

export async function applyTransfer(prisma: PrismaClient, actor: ModelActor, model: string, token: string, preview = false) {
  const ticket = unsign(token);
  const { entry, spec, service, fingerprint } = transferContract(model);
  if (ticket.actor !== actor.id || ticket.version !== actor.sessionVersion || ticket.model !== model || ticket.contract !== fingerprint || ticket.expires < Date.now()) throw new ModelValidationError("El plan cambió o expiró; vuelve a revisar el archivo.");
  try { return await prisma.$transaction(async tx => {
    await authorizeTransfer(tx, actor, model, "import");
    const result = { created: 0, updated: 0, unchanged: 0 };
    const pending: { row: Reviewed; input: Record<string, unknown>; id?: string }[] = [];
    let activeRow = 0;
    try {
      // Resolve and validate EVERY baseline before writes: importing siblings legitimately
      // advances their common owner's revision, which must not invalidate this same batch.
      for (const row of ticket.rows) {
        activeRow = row.row;
        const decoded = await decodeTransferReferences(tx, actor, entry, spec, row.values);
        const normalized = normalizeTransferDraft(entry, decoded);
        const identity = transferIdentity(entry, spec, normalized);
        if (digest(identity) !== digest(row.identity)) throw new ModelValidationError("La clave o su referencia cambió; vuelve a revisar el archivo.");
        const current = await service.findUniqueInTransaction(tx, actor, spec.key, typeof spec.key === "string" ? identity[spec.key] : identity);
        if (digest(current) !== row.baseline) throw new ModelValidationError("El registro o sus líneas cambiaron después de revisar; vuelve a revisar el archivo.");
        const input = await prepareTransferDocument(tx, actor, entry, spec, { ...decoded, ...identity }, current);
        const before = await encodeTransferValues(tx, actor, entry, spec, input, row.operation === "unchanged");
        if (digest(before.references) !== row.references) throw new ModelValidationError("Un registro relacionado cambió después de revisar; vuelve a revisar el archivo.");
        await authorizeModel(tx, actor, model, current ? "write" : "create");
        if (current && !await service.transaction.snapshot(tx, actor, current.id, "write")) throw new AccessError("DENIED");
        pending.push({ row, input, id: current?.id });
      }
      for (const item of pending) {
        const { row } = item; activeRow = row.row;
        if (row.operation === "unchanged") { result.unchanged++; continue; }
        const saved = await service.transaction.persist(tx, actor, item.input);
        item.id = saved.id;
        assertTransferIdentity(entry, spec, item.input, saved);
        if (row.operation === "create") result.created++; else result.updated++;
      }
      for (const item of pending) {
        activeRow = item.row.row;
        const saved = await service.transaction.snapshot(tx, actor, item.id!);
        if (!saved) throw new ModelValidationError("El registro ya no está disponible.");
        const display = await encodeTransferValues(tx, actor, entry, spec, saved, true);
        if (digest(display.values) !== item.row.expected) throw new ModelValidationError("El resultado de la lógica del modelo cambió desde la revisión; vuelve a revisar el archivo.");
      }
    } catch (error) {
      throw new BatchValidationError(activeRow, Object.values(errorsFor(error)).join(" "));
    }
    if (preview) throw new BatchPreviewRollback(result);
    return result;
  }, { isolationLevel: "Serializable", timeout: 60_000 }); }
  catch (error) {
    if (preview && error instanceof BatchPreviewRollback) return error.result;
    throw error;
  }
}

export async function exportTransfer(prisma: PrismaClient, actor: ModelActor, model: string, input: unknown) {
  const { entry, spec, service } = transferContract(model);
  const request = z.strictObject({ format: z.enum(["csv", "xlsx"]), template: z.boolean(), state: listStateSchema, selection: z.array(z.string().min(1).max(100)).max(50) }).parse(input);
  if (new Set(request.selection).size !== request.selection.length) throw new ModelValidationError("Selección duplicada.");
  const rows = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await authorizeTransfer(tx, actor, model, request.template ? "import" : "export");
    if (request.template) return [];
    const output: Record<string, unknown>[] = [];
    let page = 1;
    const selected = new Set(request.selection);
    const exported = new Set<string>();
    const references: TransferReferenceCache = new Map();
    while (true) {
      const result = await service.listInTransaction(prisma, tx, actor, { ...request.state, page, pageSize: 50, groupBy: [], groupPath: [] });
      if (!result.ok) throw new ModelValidationError(result.error);
      if (result.data.total > 2000) throw new ModelValidationError("Máximo 2.000 registros filtrados; reduce los filtros antes de exportar.");
      for (const row of result.data.rows.filter(row => !selected.size || selected.has(row.id))) {
        const document = Object.keys(spec.lines ?? {}).length || Object.keys(spec.many2many ?? {}).length ? await service.transaction.snapshot(tx, actor, row.id) : row;
        if (!document) throw new ModelValidationError("El registro ya no está disponible.");
        output.push(...flattenTransferDocument(spec, (await encodeTransferValues(tx, actor, entry, spec, document, false, references)).values));
        exported.add(row.id);
        if (output.length > 2000) throw new ModelValidationError("Máximo 2.000 filas exportadas, incluidas las líneas; reduce los filtros.");
      }
      if (page * 50 >= result.data.total) break;
      page++;
    }
    if (selected.size && exported.size !== selected.size) throw new ModelValidationError("La selección cambió o contiene registros fuera de tus filtros/permisos. Actualiza la lista.");
    return output;
  }, { isolationLevel: "RepeatableRead", timeout: 30_000 });
  return writeTransferFile(request.format as TransferFormat, transferHeaders(spec), rows, `${entry.key}${request.template ? "-plantilla" : ""}`);
}
