import "server-only";
import type { FieldMetadata } from "./fields";

export const MAX_DISPLAY_RELATIONS = 3;
export const relationFieldName = (field: string) => field.endsWith("Id") ? field.slice(0, -2) : `${field}Record`;
type Metadata = Readonly<Record<string, FieldMetadata>>;
const invalid = () => new Error("displayFields necesita escalares no sensibles o rutas Many2one declaradas (máximo tres relaciones).");

export function displayPathParts(path: string): string[] {
  if (typeof path !== "string" || path.length > 240) throw invalid();
  const parts = path.split(".");
  if (parts.length > MAX_DISPLAY_RELATIONS + 1 || parts.some(part => !/^[a-z][A-Za-z0-9]*$/.test(part) || ["constructor", "prototype", "__proto__"].includes(part))) throw invalid();
  return parts;
}

export function displayRelation(metadata: Metadata, alias: string): [string, Extract<FieldMetadata, { kind: "many2one" }>] {
  if (Object.hasOwn(metadata, alias)) throw invalid();
  const matches = Object.entries(metadata).filter((entry): entry is [string, Extract<FieldMetadata, { kind: "many2one" }>] => entry[1].kind === "many2one" && relationFieldName(entry[0]) === alias);
  if (matches.length !== 1 || matches[0][1].sensitive) throw invalid();
  return matches[0];
}

/** Validate local dependencies now; generated repositories validate every related publication boundary. */
export function displayFieldPaths(metadata: Metadata, declared?: readonly string[]): readonly string[] {
  const paths = declared ?? (metadata.name?.kind === "text" && !metadata.name.sensitive ? ["name"] : []);
  if (!Array.isArray(paths) || paths.filter(path => path !== "id").length > 12 || new Set(paths).size !== paths.length) throw invalid();
  for (const path of paths) {
    const parts = displayPathParts(path);
    if (parts.length > 1) displayRelation(metadata, parts[0]);
    else if (path !== "id" && (!Object.hasOwn(metadata, path) || metadata[path].sensitive)) throw invalid();
  }
  return Object.freeze([...new Set(["id", ...paths])]);
}

/** Fresh, deeply readonly projection. Methods never see fields outside their dependencies. */
export function projectDisplayRecord(record: Readonly<Record<string, unknown>>, paths: readonly string[]): Readonly<Record<string, unknown>> & { readonly id: string } {
  if (!Object.hasOwn(record, "id") || typeof record.id !== "string" || !record.id) throw new Error("displayName necesita el ID del registro.");
  const result: Record<string, unknown> = { id: record.id };
  for (const path of paths) {
    const parts = displayPathParts(path);
    let source: Readonly<Record<string, unknown>> = record, target = result;
    for (let index = 0; index < parts.length; index++) {
      const key = parts[index];
      const value = Object.hasOwn(source, key) ? source[key] : undefined;
      if (index === parts.length - 1) {
        if (value !== null && value !== undefined && !(value instanceof Date) && !["string", "number", "boolean"].includes(typeof value)) throw invalid();
        target[key] = value instanceof Date ? value.toISOString() : value;
      } else {
        if (value === null || value === undefined) { target[key] = null; break; }
        if (typeof value !== "object" || Array.isArray(value) || value instanceof Date) throw invalid();
        const nested = (Object.hasOwn(target, key) ? target[key] : {}) as Record<string, unknown>;
        target[key] = nested;
        target = nested; source = value as Readonly<Record<string, unknown>>;
      }
    }
  }
  const freeze = (value: Record<string, unknown>): Readonly<Record<string, unknown>> => {
    for (const child of Object.values(value)) if (child && typeof child === "object") freeze(child as Record<string, unknown>);
    return Object.freeze(value);
  };
  return freeze(result) as Readonly<Record<string, unknown>> & { readonly id: string };
}

export type DisplayGuard = { metadata: FieldMetadata | undefined; target?: string };
export type LookupSelect = { [field: string]: true | { select: LookupSelect } };

/** Server-generated whitelist only. Never accept this policy or a select tree from the browser. */
export function displayLookupSelect(fields: readonly string[], policy: Readonly<Record<string, readonly DisplayGuard[]>>): LookupSelect {
  if (fields.length > 13 || new Set(fields).size !== fields.length) throw invalid();
  const select: LookupSelect = {};
  for (const path of fields) {
    const parts = displayPathParts(path);
    if (!Object.hasOwn(policy, path)) throw new Error("Campo de presentación no permitido. Actualiza orm:bind.");
    for (const guard of policy[path]) {
      if (!guard.metadata || guard.metadata.sensitive || (guard.target && (guard.metadata.kind !== "many2one" || guard.metadata.target !== guard.target))) throw new Error("Dependencia de presentación no publicada o sensible. Actualiza orm:bind.");
    }
    let node = select;
    for (let index = 0; index < parts.length; index++) {
      const key = parts[index];
      const existing = Object.hasOwn(node, key) ? node[key] : undefined;
      if (index === parts.length - 1) {
        if (existing && existing !== true) throw invalid();
        node[key] = true;
      } else {
        if (existing === true) throw invalid();
        const relation = existing ?? { select: {} };
        node[key] = relation; node = relation.select;
      }
    }
  }
  return select;
}
