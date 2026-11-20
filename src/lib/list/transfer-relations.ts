import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ModuleModel } from "../modules/define";
import { installedModules, modelService } from "../modules/registry";
import { relationDomainWhere } from "../modules/relation-domains";
import { domainDependencies } from "../orm/domain-builder";
import { ModelValidationError, type ModelActor } from "../orm/context";
import { modelSnapshot } from "../orm/snapshot";
import type { Field } from "../orm/fields";
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
  const target = metadata?.kind === "many2one" && installedModules().flatMap(module => module.models).find(model => model.contract.name === metadata.target);
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
    let model = entry, field = column.field;
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
  const values: Record<string, unknown> = Object.fromEntries(columns.map(column => [column.header, column.path.length ? "" : record[column.field]]));
  const references: SignedReference[] = [];
  for (const [field, reference] of Object.entries(spec.relations ?? {})) {
    if (blank(record[field])) continue;
    const row = await encodeReference(tx, actor, entry, field, reference, record[field], field, [], values, references, cache);
    const metadata = entry.metadata[field];
    if (checkDomains && metadata.kind === "many2one" && metadata.domain) {
      const target = targetFor(entry, field);
      const draft = Object.fromEntries(domainDependencies(metadata.domain).map(name => [name, record[name]]));
      const where = relationDomainWhere(entry, target, metadata.domain, draft);
      const candidates = await modelService(target.id).lookupInTransaction(tx, actor, { ids: [String(row.id)] }, where);
      if (!candidates.items.some(item => item.value === row.id)) throw new ModelValidationError("La referencia no cumple el dominio.", { [referenceLabel(field, reference, [])]: "Selecciona una referencia compatible con los datos de la fila." });
    }
  }
  return { values, references };
}
