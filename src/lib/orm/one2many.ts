import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { ModelValidationError, type ModelActor } from "./context";
import type { FieldMetadata, One2manyMetadata } from "./fields";
import { recordIdentitySchema } from "./record";
import { planOne2manyChanges } from "../one2many/changes";

export type Document = Record<string, unknown> & { id: string; revision: string };
/**
 * `withLines`: the deletion comes from the owner's document (a removed line), so the line's own
 * lines go with it, bottom-up and through their services. A standalone deletion keeps Restrict.
 */
export type MutationOptions = { skipOwner?: { model: string; id: string }; previous?: Document; withLines?: boolean; system?: boolean };
/** Nested documents: document → line → sub-line, and a bounded total for the whole tree. */
export const MAX_LINE_DEPTH = 3;
export const MAX_DOCUMENT_ROWS = 500;
export type TransactionModel = {
  readonly name: string;
  readonly metadata: Readonly<Record<string, FieldMetadata>>;
  /** One2many relations of this model: its rows are documents with their own lines. */
  readonly lines: LineRelations;
  snapshot(tx: Prisma.TransactionClient, actor: ModelActor, id: string, operation?: "read" | "write"): Promise<Document | null>;
  owned(tx: Prisma.TransactionClient, actor: ModelActor, inverse: string, id: string, maximum: number): Promise<Document[]>;
  persist(tx: Prisma.TransactionClient, actor: ModelActor, input: unknown, label?: string, options?: MutationOptions): Promise<Document>;
  remove(tx: Prisma.TransactionClient, actor: ModelActor, id: string, revision: string, options?: MutationOptions): Promise<void>;
  refresh(tx: Prisma.TransactionClient, actor: ModelActor, previous: Document): Promise<void>;
  present?(tx: Prisma.TransactionClient, actor: ModelActor, record: Document): Promise<Document>;
  prepareInput?(tx: Prisma.TransactionClient, actor: ModelActor, input: Record<string, unknown>, previous: Document | null, inverse?: string): Promise<Record<string, unknown>>;
};
export type LineRelation = { metadata: One2manyMetadata; child: () => TransactionModel };
export type OwnerRelation = { inverse: string; parent: () => TransactionModel };
export type LineRelations = Readonly<Record<string, LineRelation>>;

function lineFailure(error: unknown, path: string, inverse: string): never {
  if (error instanceof ModelValidationError) throw new ModelValidationError(error.message, Object.fromEntries(Object.entries(error.fieldErrors ?? { "": error.message }).map(([key, message]) => [key === inverse ? path : `${path}${key ? `.${key}` : ""}`, message])));
  if (error instanceof z.ZodError) throw new ModelValidationError("Revisa los datos de las líneas.", Object.fromEntries(error.issues.map(issue => [`${path}${issue.path.length ? `.${issue.path.join(".")}` : ""}`, issue.message])));
  throw error;
}

export async function loadLines(tx: Prisma.TransactionClient, actor: ModelActor, parent: Document, relations: LineRelations) {
  const values: Record<string, unknown> = {};
  for (const [name, relation] of Object.entries(relations)) {
    const rows = await relation.child().owned(tx, actor, relation.metadata.inverse, parent.id, relation.metadata.maxRows);
    values[name] = rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== relation.metadata.inverse)));
  }
  return { ...parent, ...values };
}

/** Before hooks can discard keys: identity, complete-set ownership and inverse are server-controlled. */
export function validateLines(input: Record<string, unknown>, previous: Document | null, relations: LineRelations) {
  for (const [name, relation] of Object.entries(relations)) {
    const rows = input[name];
    const { minRows, maxRows, inverse } = relation.metadata;
    if (!Array.isArray(rows) || rows.length < minRows || rows.length > maxRows) throw new ModelValidationError(`Revisa las líneas de ${relation.metadata.label ?? name}.`, { [name]: `Envía la colección completa, entre ${minRows} y ${maxRows} líneas.` });
    const owned = (previous?.[name] ?? []) as Document[];
    for (const [index, row] of rows.entries()) {
      const child = relation.child();
      if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).some(key => key === inverse || (!["id", "revision"].includes(key) && !Object.hasOwn(child.metadata, key) && !Object.hasOwn(child.lines, key)))) throw new ModelValidationError("La línea contiene campos no permitidos.", { [`${name}.${index}`]: "No envíes la relación inversa ni campos no declarados." });
      const identity = recordIdentitySchema.safeParse({ id: row.id, revision: row.revision });
      if (!identity.success) throw new ModelValidationError("La identidad de la línea no es válida.", { [`${name}.${index}`]: "El ID y la revisión deben enviarse juntos." });
      if (row.id && !owned.some(current => current.id === row.id && current.revision === row.revision)) throw new ModelValidationError("Una línea cambió o no pertenece al documento. Recarga antes de guardar.", { [`${name}.${index}`]: "La línea no está disponible con esta revisión." });
    }
    try { planOne2manyChanges(owned, rows); } catch { throw new ModelValidationError("Las líneas contienen IDs ajenos o duplicados.", { [name]: "Revisa la identidad de las líneas." }); }
  }
}

export async function persistLines(tx: Prisma.TransactionClient, actor: ModelActor, parent: Document, input: Record<string, unknown>, previous: Document | null, relations: LineRelations, model: string) {
  let changed = false;
  for (const [name, relation] of Object.entries(relations)) {
    const child = relation.child(), inverse = relation.metadata.inverse;
    const owned = (previous?.[name] ?? []) as Document[];
    const changes = planOne2manyChanges(owned, input[name] as (Record<string, unknown> & { id?: string })[]);
    // The owner has already hydrated/revalidated every child's protected input before its schema/hooks.
    const options = { skipOwner: { model, id: parent.id }, system: true };
    for (const item of changes.create) {
      try { await child.persist(tx, actor, { ...item.values, [inverse]: parent.id }, undefined, options); changed = true; }
      catch (error) { lineFailure(error, `${name}.${item.index}`, inverse); }
    }
    for (const item of changes.update) {
      const old = owned.find(row => row.id === item.id)!;
      // Sub-lines count as content: a changed sub-line persists its line (and its revision).
      const different = [...Object.keys(child.metadata), ...Object.keys(child.lines)].filter(key => key !== inverse).some(key => JSON.stringify(old[key]) !== JSON.stringify(item.values[key]));
      if (!different) continue;
      try { await child.persist(tx, actor, { ...item.values, [inverse]: parent.id }, undefined, options); changed = true; }
      catch (error) { lineFailure(error, `${name}.${item.index}`, inverse); }
    }
    for (const id of changes.deleteIds) {
      const row = owned.find(row => row.id === id)!;
      try { await child.remove(tx, actor, row.id, row.revision, { ...options, withLines: true }); changed = true; }
      catch (error) { lineFailure(error, name, inverse); }
    }
  }
  return { values: await loadLines(tx, actor, parent, relations), changed };
}

/** Independent child writes must validate/invalidate their owner in the SAME transaction. */
export async function captureOwners(tx: Prisma.TransactionClient, actor: ModelActor, previous: Document | null, next: Record<string, unknown>, owners: readonly OwnerRelation[], options?: MutationOptions) {
  const snapshots: { parent: TransactionModel; previous: Document }[] = [];
  for (const owner of owners) {
    const id = next[owner.inverse] ?? previous?.[owner.inverse];
    if (previous && previous[owner.inverse] !== id) throw new ModelValidationError("No se permite mover una línea a otro documento.", { [owner.inverse]: "Conserva el documento original." });
    if (typeof id !== "string" || !id) throw new ModelValidationError("La línea necesita un documento padre.");
    const parent = owner.parent();
    if (options?.skipOwner?.model === parent.name && options.skipOwner.id === id) continue;
    const snapshot = await parent.snapshot(tx, actor, id, "write");
    if (!snapshot) throw new ModelValidationError("El documento padre no está disponible.");
    snapshots.push({ parent, previous: snapshot });
  }
  return snapshots;
}

/** Rows of a submitted document tree (every level), checked before any write. */
export function countDocumentRows(input: Record<string, unknown>, relations: LineRelations): number {
  let total = 0;
  for (const [name, relation] of Object.entries(relations)) {
    const rows = input[name];
    if (!Array.isArray(rows)) continue;
    total += rows.length;
    for (const row of rows) if (row && typeof row === "object" && !Array.isArray(row)) total += countDocumentRows(row as Record<string, unknown>, relation.child().lines);
  }
  return total;
}
