import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ModuleModel } from "../modules/define";
import { installedModules, modelService } from "../modules/registry";
import { relationDomainWhere } from "../modules/relation-domains";
import { domainDependencies } from "../orm/domain-builder";
import { ModelValidationError, type ModelActor } from "../orm/context";
import { modelSnapshot } from "../orm/snapshot";
import type { Field } from "../orm/fields";
import { cellValue } from "./transfer-file";
import { transferColumns, transferKeyFields, transferReferenceColumns, transferReferenceKeys, type TransferReference, type TransferSpec } from "./transfer-contract";

type ReferenceRecord = NonNullable<Awaited<ReturnType<ReturnType<typeof modelService>["findUniqueInTransaction"]>>>;
/** One actor's readonly export transaction only; never reuse across writes or requests. */
export type TransferReferenceCache = Map<string, ReferenceRecord>;
/** Cells of one reference, keyed by their path inside it (`codigo`, `paisId.codigo`). */
export type TransferReferenceCells = Record<string, unknown>;
type SignedReference = { field: string; model: string; id: string; revision: unknown; key: unknown };

const blank = (value: unknown) => value === "" || value === null || value === undefined;

function targetFor(entry: ModuleModel, field: string) {
  const metadata = entry.metadata[field];
  const name = metadata?.kind === "many2one" ? metadata.target : entry.contract.many2manyFields[field]?.many2many.target ?? entry.contract.one2manyFields[field]?.one2many.target;
  const target = name && installedModules().flatMap(module => module.models).find(model => model.contract.name === name);
  if (!target) throw new ModelValidationError("El destino de la relación no está disponible.");
  return target;
}
/** Error key for a whole reference: its single column, or all of them for a compound key. */
const referenceLabel = (field: string, reference: TransferReference, prefix: readonly string[]) =>
  transferReferenceColumns(field, reference, prefix).map(column => column.header).join(" + ");

export function normalizeTransferDraft(entry: ModuleModel, values: Record<string, unknown>): Record<string, unknown> {
  const instance = new entry.declaration.model();
  const draft = { ...entry.contract.createDefaults(), ...values };
  return instance.normalize ? instance.normalize(modelSnapshot(draft)) : draft;
}

/** Field kind of each column, following references to the destination that owns the cell. */
export function transferColumnKinds(entry: ModuleModel, spec: TransferSpec): ReadonlyMap<string, string> {
  return new Map(transferColumns(spec).map(column => {
    let model = entry;
    for (const field of column.document ?? []) model = targetFor(model, field);
    let field = column.field;
    if (!column.path.length && model.contract.many2manyFields[field]) return [column.header, "many2many"];
    for (const step of column.path) { model = targetFor(model, field); field = step; }
    const kind = model.metadata[field].kind;
    return [column.header, kind === "many2one" ? "text" : kind];
  }));
}

/** Apply the field's own conversions (e.g. Text trim) before matching an identity. */
export function transferIdentity(entry: ModuleModel, spec: TransferSpec, draft: Record<string, unknown>) {
  const fields = entry.contract.fields as Readonly<Record<string, Field>>;
  return Object.fromEntries(transferKeyFields(spec).map(name => {
    const parsed = fields[name].schema.safeParse(draft[name]);
    if (!parsed.success || blank(parsed.data)) {
      const header = spec.relations?.[name] ? referenceLabel(name, spec.relations[name], []) : name;
      throw new ModelValidationError("Revisa la clave de importación.", { [header]: parsed.success ? "La clave es obligatoria." : parsed.error.issues[0]?.message ?? "Clave inválida." });
    }
    return [name, parsed.data];
  }));
}

/**
 * Resolve innermost hops first (País by código, then Estado by País+código). Every hop
 * uses the destination's normalization/schema and its read access and record rules.
 */
async function resolveReference(tx: Prisma.TransactionClient, actor: ModelActor, owner: ModuleModel, field: string, reference: TransferReference, cells: TransferReferenceCells, root: string, prefix: readonly string[]): Promise<string> {
  const target = targetFor(owner, field), keys = transferReferenceKeys(reference);
  const values: Record<string, unknown> = {};
  for (const key of keys) {
    const nested = reference.relations?.[key];
    values[key] = nested ? await resolveReference(tx, actor, target, key, nested, cells, root, [...prefix, key]) : cells[[...prefix, key].join(".")];
  }
  const normalized = normalizeTransferDraft(target, values);
  const fields = target.contract.fields as Readonly<Record<string, Field>>;
  const identity: Record<string, unknown> = {};
  for (const key of keys) {
    // Nested hops already returned an authorized ID; never re-read it from the draft.
    if (reference.relations?.[key]) { identity[key] = values[key]; continue; }
    const parsed = fields[key].schema.safeParse(normalized[key]);
    if (!parsed.success || blank(parsed.data)) throw new ModelValidationError("Revisa la clave de la referencia.", { [[root, ...prefix, key].join(".")]: parsed.success ? "La clave es obligatoria." : parsed.error.issues[0]?.message ?? "Clave inválida." });
    identity[key] = parsed.data;
  }
  const row = await modelService(target.id).findUniqueInTransaction(tx, actor, keys.length === 1 ? keys[0] : keys, keys.length === 1 ? identity[keys[0]] : identity, true);
  if (!row) throw new ModelValidationError("Revisa la referencia.", { [referenceLabel(root, reference, prefix)]: "La referencia no existe o no está disponible con tus permisos." });
  return String(row.id);
}

/** Input carries external keys only. Missing columns stay omitted; all-blank explicitly clears. */
export async function decodeTransferReferences(tx: Prisma.TransactionClient, actor: ModelActor, entry: ModuleModel, spec: TransferSpec, raw: Record<string, unknown>) {
  const values = { ...raw };
  for (const [field, reference] of Object.entries(spec.relations ?? {})) {
    if (!Object.hasOwn(raw, field)) continue;
    const cells = raw[field];
    if (!cells || typeof cells !== "object") throw new ModelValidationError("Revisa la referencia.", { [referenceLabel(field, reference, [])]: "Referencia inválida." });
    const columns = transferReferenceColumns(field, reference);
    const missing = columns.filter(column => blank((cells as TransferReferenceCells)[column.path.join(".")]));
    if (missing.length === columns.length) { values[field] = null; continue; }
    if (missing.length) throw new ModelValidationError("Completa la referencia.", Object.fromEntries(missing.map(column => [column.header, "Completa todas las columnas de la referencia o déjalas vacías."])));
    values[field] = await resolveReference(tx, actor, entry, field, reference, cells as TransferReferenceCells, field, []);
  }
  return values;
}

/** Complete document input, retaining server identities and all unpublished/omitted values. */
export async function prepareTransferDocument(tx: Prisma.TransactionClient, actor: ModelActor, entry: ModuleModel, spec: TransferSpec, decoded: Record<string, unknown>, current: Record<string, unknown> | null): Promise<Record<string, unknown>> {
  const input: Record<string, unknown> = { ...(current ?? entry.contract.createDefaults()), ...decoded };
  for (const [field, reference] of Object.entries(spec.many2many ?? {})) {
    if (!Object.hasOwn(decoded, field)) continue;
    const columns = transferReferenceColumns(field, reference);
    const raw = decoded[field];
    let cells: unknown;
    try { cells = blank(raw) ? [] : JSON.parse(String(raw)); }
    catch { throw new ModelValidationError("Revisa las relaciones múltiples.", { [field]: "Usa un arreglo JSON de claves externas." }); }
    const maximum = entry.contract.many2manyFields[field].many2many.maxSelected;
    if (!Array.isArray(cells) || cells.length > maximum) throw new ModelValidationError("Revisa las relaciones múltiples.", { [field]: `Usa un arreglo JSON con hasta ${maximum} claves.` });
    const ids: string[] = [];
    const simple = transferReferenceKeys(reference).length === 1;
    const names = columns.map(column => column.path.join("."));
    const kinds = transferColumnKinds(entry, { key: "", fields: [field], relations: { [field]: reference } });
    for (const item of cells) {
      const values = simple ? { [columns[0].path.join(".")]: item } : item;
      if (!values || typeof values !== "object" || Array.isArray(values) || Object.keys(values).length !== names.length || names.some(name => !Object.hasOwn(values, name))) throw new ModelValidationError("Revisa las relaciones múltiples.", { [field]: `Cada clave debe contener ${names.join(", ")}.` });
      const parsed = Object.fromEntries(columns.map(column => [column.path.join("."), cellValue((values as Record<string, unknown>)[column.path.join(".")], kinds.get(column.header)!)]));
      const id = await resolveReference(tx, actor, entry, field, reference, parsed, field, []);
      if (ids.includes(id)) throw new ModelValidationError("Clave repetida en relaciones múltiples.", { [field]: "No repitas una referencia después de normalizar." });
      ids.push(id);
    }
    // Reading the current document already checks every existing link's access.
    input[field] = [...new Set([...(reference.mode === "add" ? (current?.[field] as string[] | undefined) ?? [] : []), ...ids])].sort();
  }
  for (const [field, line] of Object.entries(spec.lines ?? {})) {
    if (!Object.hasOwn(decoded, field)) continue;
    const target = targetFor(entry, field);
    const owned = (current?.[field] ?? []) as Record<string, unknown>[];
    const incoming = decoded[field];
    if (!Array.isArray(incoming)) throw new ModelValidationError("Revisa las líneas.", { [field]: "Envía filas agrupadas por la clave del padre." });
    const updated: Record<string, unknown>[] = [], seen = new Set<string>();
    for (const [index, raw] of incoming.entries()) {
      try {
        const values = await decodeTransferReferences(tx, actor, target, line, raw);
        const identity = transferIdentity(target, line, normalizeTransferDraft(target, values));
        const key = JSON.stringify(identity);
        if (seen.has(key)) throw new ModelValidationError("Clave de línea repetida después de normalizar.");
        seen.add(key);
        const existing = owned.find(row => Object.entries(identity).every(([name, value]) => row[name] === value)) ?? null;
        const document = await prepareTransferDocument(tx, actor, target, line, { ...values, ...identity }, existing);
        delete document[entry.contract.one2manyFields[field].one2many.inverse];
        updated.push(document);
      } catch (error) {
        if (!(error instanceof ModelValidationError)) throw error;
        throw new ModelValidationError(error.message, Object.fromEntries(Object.entries(error.fieldErrors ?? { "": error.message }).map(([name, message]) => [`${field}.${index}${name ? `.${name}` : ""}`, message])));
      }
    }
    const ids = new Set(updated.map(row => row.id).filter(Boolean));
    input[field] = [...updated, ...owned.filter(row => !ids.has(row.id))];
  }
  return input;
}

/** Hooks may normalize values, but cannot silently retarget the reviewed document or its lines. */
export function assertTransferIdentity(entry: ModuleModel, spec: TransferSpec, input: Record<string, unknown>, saved: Record<string, unknown>) {
  const key = (row: Record<string, unknown>) => JSON.stringify(transferIdentity(entry, spec, row));
  if (key(input) !== key(saved)) throw new ModelValidationError("La lógica del modelo cambió la clave; revisa su normalización.");
  for (const [field, line] of Object.entries(spec.lines ?? {})) {
    const target = targetFor(entry, field);
    const identity = (row: Record<string, unknown>) => JSON.stringify(transferIdentity(target, line, row));
    const previous = input[field] as Record<string, unknown>[], next = saved[field] as Record<string, unknown>[];
    const byKey = new Map(next.map(row => [identity(row), row]));
    if (byKey.size !== previous.length || previous.some(row => !byKey.has(identity(row)))) throw new ModelValidationError("La lógica del modelo cambió las claves de las líneas.", { [field]: "Conserva las claves revisadas de cada línea." });
    for (const row of previous) assertTransferIdentity(target, line, row, byKey.get(identity(row))!);
  }
}

async function checkDomain(tx: Prisma.TransactionClient, actor: ModelActor, entry: ModuleModel, field: string, id: string, record: Record<string, unknown>) {
  const metadata = entry.metadata[field];
  const domain = metadata?.kind === "many2one" ? metadata.domain : entry.contract.many2manyFields[field]?.many2many.domain;
  if (!domain) return;
  const target = targetFor(entry, field);
  const draft = Object.fromEntries(domainDependencies(domain).map(name => [name, record[name]]));
  const candidates = await modelService(target.id).lookupInTransaction(tx, actor, { ids: [id] }, relationDomainWhere(entry, target, domain, draft));
  if (!candidates.items.some(item => item.value === id)) throw new ModelValidationError("La referencia no cumple el dominio.", { [field]: "Selecciona una referencia compatible con los datos de la fila." });
}

/** Walk outward from an ID, writing each leaf key and signing every hop's identity/revision. */
async function encodeReference(tx: Prisma.TransactionClient, actor: ModelActor, owner: ModuleModel, field: string, reference: TransferReference, id: unknown, root: string, prefix: readonly string[], values: Record<string, unknown>, references: SignedReference[], cache?: TransferReferenceCache) {
  const target = targetFor(owner, field), keys = transferReferenceKeys(reference);
  const cacheKey = `${target.id}:${id}`;
  const row = cache?.get(cacheKey) ?? await modelService(target.id).findUniqueInTransaction(tx, actor, "id", id, true);
  if (!row) throw new ModelValidationError("La referencia no está disponible con tus permisos.", { [referenceLabel(root, reference, prefix)]: "Revisa el registro relacionado." });
  cache?.set(cacheKey, row);
  references.push({ field: [root, ...prefix].join("."), model: target.id, id: String(row.id), revision: row.revision, key: keys.length === 1 ? row[keys[0]] : Object.fromEntries(keys.map(key => [key, row[key]])) });
  for (const key of keys) {
    const nested = reference.relations?.[key];
    if (!nested) { values[[root, ...prefix, key].join(".")] = row[key]; continue; }
    if (blank(row[key])) throw new ModelValidationError("La referencia está incompleta.", { [referenceLabel(root, nested, [...prefix, key])]: "Revisa el registro relacionado." });
    await encodeReference(tx, actor, target, key, nested, row[key], root, [...prefix, key], values, references, cache);
  }
  return row;
}

/** Only explicit external keys cross the spreadsheet boundary, never IDs or labels. */
export async function encodeTransferValues(tx: Prisma.TransactionClient, actor: ModelActor, entry: ModuleModel, spec: TransferSpec, record: Record<string, unknown>, checkDomains = false, cache?: TransferReferenceCache) {
  const columns = transferColumns(spec);
  // Fixed column order: digests of the reviewed values must not depend on resolution order.
  const values: Record<string, unknown> = Object.fromEntries(columns.filter(column => !column.document?.length).map(column => [column.header, column.path.length ? "" : record[column.field]]));
  const references: SignedReference[] = [];
  for (const [field, reference] of Object.entries(spec.relations ?? {})) {
    if (blank(record[field])) continue;
    const row = await encodeReference(tx, actor, entry, field, reference, record[field], field, [], values, references, cache);
    if (checkDomains) await checkDomain(tx, actor, entry, field, String(row.id), record);
  }
  for (const [field, reference] of Object.entries(spec.many2many ?? {})) {
    const keys: unknown[] = [];
    for (const id of (record[field] ?? []) as string[]) {
      const cells: Record<string, unknown> = {};
      await encodeReference(tx, actor, entry, field, reference, id, field, [], cells, references, cache);
      if (checkDomains) await checkDomain(tx, actor, entry, field, id, record);
      const columns = transferReferenceColumns(field, reference);
      keys.push(transferReferenceKeys(reference).length === 1 ? cells[columns[0].header] : Object.fromEntries(columns.map(column => [column.path.join("."), cells[column.header]])));
    }
    values[field] = JSON.stringify(keys.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  }
  for (const [field, line] of Object.entries(spec.lines ?? {})) {
    const encoded = [];
    for (const row of (record[field] ?? []) as Record<string, unknown>[]) {
      const child = await encodeTransferValues(tx, actor, targetFor(entry, field), line, row, checkDomains, cache);
      encoded.push(child.values);
      references.push(...child.references.map(reference => ({ ...reference, field: `${field}.${row.id ?? "new"}.${reference.field}` })));
    }
    // Document order has no persistent meaning; digest by the public business key.
    values[field] = encoded.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  if (Object.keys(spec.lines ?? {}).length || Object.keys(spec.many2many ?? {}).length) references.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return { values, references };
}
