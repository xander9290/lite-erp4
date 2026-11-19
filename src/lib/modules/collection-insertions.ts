import type { InsertionEntry, InsertionModule, InsertionSlot } from "@/components/ui/form/insertions/resolve";
import type { ModelColumn } from "./collection";

/**
 * Pure placement of collection insertions (ModelCollection). Entries already carry their
 * declared columns (`<Column field>`). The server keeps deciding what is published and which
 * operations each column allows; insertions only choose which published columns show and where.
 * Contract: docs/inserciones-vistas.md#colecciones.
 */

export const maxCollectionColumns = 12;
export type ColumnEntry = InsertionEntry<readonly ModelColumn[]>;
export type CardZoneName = "title" | "body" | "footer";
export type CardZoneColumns = { readonly before: readonly ModelColumn[]; readonly inside: readonly ModelColumn[]; readonly after: readonly ModelColumn[] };
export type CardColumns = Readonly<Record<CardZoneName, CardZoneColumns>>;

export type InsertionFieldPolicy = {
  /** Fields published by the server for the collection (`config.list.fields`). */
  readonly published: readonly string[];
  /** Fields contributed by each extension module. */
  readonly extensionFields: Readonly<Record<string, readonly string[]>>;
  readonly modules: readonly InsertionModule[];
};

/**
 * A module only shows published fields of its own extension or of extensions it depends on;
 * `replace` may also re-present the column it replaces.
 */
export function insertionFieldIssue(policy: InsertionFieldPolicy, entry: ColumnEntry, field: string): string | undefined {
  if (!policy.published.includes(field)) return `${entry.module}: ${field} no está publicado en la colección; no se muestra.`;
  if (entry.position === "replace" && entry.target === `column:${field}`) return undefined;
  const depends = policy.modules.find(item => item.module === entry.module)?.depends ?? [];
  const owners = [entry.module, ...depends];
  if (owners.some(owner => policy.extensionFields[owner]?.includes(field))) return undefined;
  return `${entry.module}: ${field} no pertenece a su extensión ni a las extensiones de las que depende; no se muestra.`;
}

type Placed = { column: ModelColumn; module?: string; rank: number };

/** Final list columns: base columns with before/after/replace, `columns:end` and fallback at the end. */
export function placeListColumns(base: readonly ModelColumn[], slots: Readonly<Record<string, InsertionSlot<readonly ModelColumn[]>>>, fallback: readonly ColumnEntry[], policy: InsertionFieldPolicy, limit = maxCollectionColumns) {
  const issues: string[] = [];
  const rank = (module: string) => { const index = policy.modules.findIndex(item => item.module === module); return index < 0 ? policy.modules.length : index; };
  const placed: Placed[] = [];
  const seen = new Set<string>();
  const add = (entries: readonly ColumnEntry[]) => {
    for (const entry of entries) for (const column of entry.content) {
      const issue = insertionFieldIssue(policy, entry, column.field);
      if (issue) { issues.push(issue); continue; }
      if (seen.has(column.field)) { issues.push(`${entry.module}: la columna ${column.field} ya está en la lista; se omite la repetida.`); continue; }
      seen.add(column.field);
      placed.push({ column, module: entry.module, rank: rank(entry.module) });
    }
  };
  for (const column of base) seen.add(column.field);
  for (const column of base) {
    const slot = slots[`column:${column.field}`];
    if (slot) add(slot.before);
    if (slot?.replace) { seen.delete(column.field); add([slot.replace]); }
    else placed.push({ column, rank: -1 });
    if (slot) add(slot.after);
  }
  add(slots["columns:end"]?.inside ?? []);
  add(fallback);
  // Over the limit: drop inserted columns of the last modules first (base columns stay).
  const excess = placed.length - limit;
  if (excess > 0) {
    const dropped = new Set(placed.map((item, index) => ({ item, index })).filter(({ item }) => item.module)
      .sort((a, b) => b.item.rank - a.item.rank || b.index - a.index).slice(0, excess).map(({ item }) => item));
    for (const item of dropped) issues.push(`${item.module}: se omite la columna ${item.column.field}; la lista admite ${limit} columnas.`);
    return { columns: placed.filter(item => !dropped.has(item)).map(item => item.column), issues };
  }
  return { columns: placed.map(item => item.column), issues };
}

const zones: readonly CardZoneName[] = ["title", "body", "footer"];

/** Rows of the default card per zone; fallback rows go to the end of the body. */
export function placeCardColumns(slots: Readonly<Record<string, InsertionSlot<readonly ModelColumn[]>>>, fallback: readonly ColumnEntry[], policy: InsertionFieldPolicy) {
  const issues: string[] = [];
  const allowed = (entries: readonly ColumnEntry[]) => entries.flatMap(entry => entry.content.filter(column => {
    const issue = insertionFieldIssue(policy, entry, column.field);
    if (issue) issues.push(issue);
    return !issue;
  }));
  const cards = Object.fromEntries(zones.map(zone => {
    const slot = slots[`card:${zone}`];
    return [zone, {
      before: allowed(slot?.before ?? []),
      inside: [...allowed(slot?.inside ?? []), ...(zone === "body" ? allowed(fallback) : [])],
      after: allowed(slot?.after ?? []),
    }];
  })) as unknown as CardColumns;
  return { cards, issues };
}
