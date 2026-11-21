import type { FieldMetadata, Many2manyField, One2manyField } from "../orm/fields";
import type { ModuleDefinition, ModuleModel } from "../modules/define";
import type { TransferCollection } from "./transfer-types";

/**
 * How a Many2one is identified in a spreadsheet: a public unique Text key, or the
 * destination's `uniqueTogether` group. Many2one members of a compound key are
 * resolved by their own nested reference (two hops at most), never by IDs or names.
 */
export type TransferReference = {
  readonly key: string | readonly string[];
  readonly relations?: Readonly<Record<string, TransferReference>>;
};
export type TransferSpec = {
  readonly key: string | readonly string[];
  readonly fields: readonly string[];
  /** Owner Many2one field → external key on the destination. */
  readonly relations?: Readonly<Record<string, TransferReference>>;
  /** One JSON array of external keys per cell; never IDs. Mode is deliberately explicit. */
  readonly many2many?: Readonly<Record<string, TransferReference & { readonly mode: "add" | "replace" }>>;
  /** Flat spreadsheet rows grouped by the parent's business key. */
  readonly lines?: Readonly<Record<string, TransferSpec & { readonly mode: "merge" }>>;
};
/** One spreadsheet column: owner field and the key path inside its reference (empty for scalars). */
export type TransferColumn = { readonly header: string; readonly field: string; readonly path: readonly string[]; readonly document?: readonly string[] };

const MAX_REFERENCE_HOPS = 2;
const asKeys = (key: string | readonly string[]): readonly string[] => typeof key === "string" ? [key] : key;
export const transferKeyFields = (spec: TransferSpec): readonly string[] => asKeys(spec.key);
export const transferReferenceKeys = (reference: TransferReference): readonly string[] => asKeys(reference.key);

/** Leaf columns of one reference, e.g. `estadoId.paisId.codigo` and `estadoId.codigo`. */
export function transferReferenceColumns(field: string, reference: TransferReference, prefix: readonly string[] = []): TransferColumn[] {
  if (prefix.length >= MAX_REFERENCE_HOPS) throw new Error(`Transferencia: máximo ${MAX_REFERENCE_HOPS} saltos por referencia.`);
  return asKeys(reference.key).flatMap(key => {
    const nested = reference.relations?.[key];
    return nested ? transferReferenceColumns(field, nested, [...prefix, key]) : [{ header: [field, ...prefix, key].join("."), field, path: [...prefix, key] }];
  });
}
export function transferColumns(spec: TransferSpec, depth = 1): readonly TransferColumn[] {
  if (depth > 3) throw new Error("Transferencia: máximo tres niveles de documento One2many.");
  return spec.fields.flatMap(field => spec.lines?.[field]
    ? transferColumns(spec.lines[field], depth + 1).map(column => ({ ...column, header: `${field}.${column.header}`, document: [field, ...(column.document ?? [])] }))
    : spec.relations?.[field] ? transferReferenceColumns(field, spec.relations[field]) : [{ header: field, field, path: [] }]);
}
export const transferHeaders = (spec: TransferSpec): readonly string[] => transferColumns(spec).map(column => column.header);
export function transferCollections(spec: TransferSpec, prefix = ""): TransferCollection[] {
  return [
    ...Object.entries(spec.many2many ?? {}).map(([field, reference]) => ({ field: prefix + field, mode: reference.mode })),
    ...Object.entries(spec.lines ?? {}).flatMap(([field, line]) => [{ field: prefix + field, mode: line.mode }, ...transferCollections(line, `${prefix}${field}.`)]),
  ];
}

function validReference(reference: TransferReference, hop: number): boolean {
  const keys = asKeys(reference?.key ?? []);
  const nested = Object.entries(reference?.relations ?? {});
  return hop <= MAX_REFERENCE_HOPS && keys.length > 0 && keys.length <= 4 && new Set(keys).size === keys.length
    && keys.every(key => typeof key === "string" && /^[a-z][A-Za-z0-9]*$/.test(key))
    && nested.every(([key, child]) => keys.includes(key) && validReference(child, hop + 1));
}

/** Fail during model registration, before a view can advertise an invalid transfer contract. */
type TransferFields = {
  metadata: Readonly<Record<string, FieldMetadata>>; clientFields: readonly string[]; listFields: readonly string[];
  customRepository?: boolean; uniqueTogether?: readonly (readonly string[])[];
  many2manyFields?: Readonly<Record<string, Many2manyField>>; one2manyFields?: Readonly<Record<string, One2manyField>>; inverse?: string;
};
export function validateTransferSpec(spec: TransferSpec, { metadata, clientFields, listFields, customRepository = false, uniqueTogether = [], ...collections }: TransferFields) {
  const keys = transferKeyFields(spec);
  const unique = (keys.length === 1 && metadata[keys[0]]?.unique && metadata[keys[0]]?.kind === "text") || uniqueTogether.some(group => group.length === keys.length && group.every(field => keys.includes(field))) || Boolean(collections.inverse && uniqueTogether.some(group => group.length === keys.length + 1 && group.includes(collections.inverse!) && keys.every(key => group.includes(key))));
  if (!spec.fields.length || spec.fields.length > 12 || new Set(spec.fields).size !== spec.fields.length || !keys.length || new Set(keys).size !== keys.length || keys.some(key => !spec.fields.includes(key)) || !unique) throw new Error("Transferencia: define una clave única declarada y campos sin duplicados.");
  if (keys.some(key => spec.lines?.[key] || spec.many2many?.[key] || key === collections.inverse) || collections.inverse && spec.fields.includes(collections.inverse)) throw new Error("Transferencia: la identidad usa escalares o Many2one; la inversa del padre no viaja en el archivo.");
  for (const name of spec.fields) {
    if (collections.one2manyFields?.[name] && spec.lines?.[name]) continue;
    if (collections.many2manyFields?.[name] && spec.many2many?.[name]) continue;
    const field = metadata[name];
    if (!field || !["text", "integer", "boolean", "selection", "datetime", "many2one"].includes(field.kind) || field.sensitive || ("writeOnly" in field && field.writeOnly) || field.readOnly || field.sequence || !clientFields.includes(name) || !listFields.includes(name) || (field.kind === "many2one" && !spec.relations?.[name])) throw new Error(`Campo no habilitado para transferencia: ${name}.`);
  }
  for (const [field, reference] of Object.entries(spec.relations ?? {})) if (!spec.fields.includes(field) || metadata[field]?.kind !== "many2one" || !validReference(reference, 1)) throw new Error(`Transferencia: referencia Many2one inválida (clave declarada, sin repetir y hasta ${MAX_REFERENCE_HOPS} saltos).`);
  for (const [field, reference] of Object.entries(spec.many2many ?? {})) if (!spec.fields.includes(field) || !collections.many2manyFields?.[field] || !validReference(reference, 1) || !["add", "replace"].includes(reference.mode)) throw new Error(`Transferencia: Many2many ${field} requiere clave externa y mode add o replace.`);
  // Independent line collections need separate tables; one chain can be represented without
  // Cartesian products or ambiguous deletions in a single CSV/XLSX sheet.
  if (Object.keys(spec.lines ?? {}).length > 1) throw new Error("Transferencia: una colección One2many por nivel; varias colecciones independientes necesitan un formato de varias tablas, todavía no admitido.");
  for (const [field, line] of Object.entries(spec.lines ?? {})) if (!spec.fields.includes(field) || !collections.one2manyFields?.[field] || line.mode !== "merge") throw new Error(`Transferencia: One2many ${field} requiere líneas editables y mode merge (conserva líneas omitidas).`);
  if (transferHeaders(spec).length > 12) throw new Error("Transferencia: máximo 12 columnas, incluidas las de cada referencia.");
  if (customRepository) throw new Error("Este repositorio requiere un contrato específico de transferencia.");
}

type ReferenceContext = { byName: ReadonlyMap<string, ModuleModel>; definitions: readonly ModuleDefinition[] };

/** The destination must be registered and reachable from the module that declares the Many2one. */
function checkReference(context: ReferenceContext, owner: string, source: ModuleModel, field: string, reference: TransferReference, label: string) {
  const descriptor = source.metadata[field];
  const targetName = descriptor?.kind === "many2one" ? descriptor.target : source.contract.many2manyFields[field]?.many2many.target;
  const target = targetName ? context.byName.get(targetName) : undefined;
  const depends = context.definitions.find(item => item.id === owner)?.application.depends ?? [];
  const failure = `${label}: transferencia requiere destino registrado, depends y clave Text única obligatoria pública.`;
  if (!target || target.module !== owner && target.module !== "core" && !depends.includes(target.module)) throw new Error(failure);
  const published = (name: string) => {
    const key = target.metadata[name];
    return Boolean(key) && !key.sensitive && !("writeOnly" in key && key.writeOnly) && !key.sequence && target.clientFields.includes(name) && target.list.fields.includes(name);
  };
  const keys = transferReferenceKeys(reference);
  if (keys.length === 1) {
    const key = target.metadata[keys[0]];
    if (!key || key.kind !== "text" || !key.unique || !key.required || !published(keys[0]) || reference.relations) throw new Error(failure);
  } else {
    const unique = (target.contract.uniqueTogether ?? []).some(group => group.length === keys.length && group.every(name => keys.includes(name)));
    const valid = keys.every(name => {
      const kind = target.metadata[name]?.kind;
      return published(name) && ["text", "integer", "selection", "many2one"].includes(kind) && (kind === "many2one") === Boolean(reference.relations?.[name]);
    });
    if (!unique || !valid) throw new Error(`${label}: la clave compuesta debe coincidir con uniqueTogether del destino, con campos públicos y cada Many2one resuelto por su propia clave.`);
  }
  // A nested hop is a Many2one of the destination: its own module/depends apply.
  for (const [nested, child] of Object.entries(reference.relations ?? {})) checkReference(context, target.module, target, nested, child, `${label}.${nested}`);
}

/** Cross-model checks run after extension composition, never infer keys from names. */
export function validateModuleTransfers(definitions: readonly ModuleDefinition[]) {
  const byName = new Map(definitions.flatMap(module => module.models.map(model => [model.contract.name, model] as const)));
  function validate(source: ModuleModel, spec: TransferSpec, depth = 1, inverse?: string) {
    if (depth > 3) throw new Error("Transferencia: máximo tres niveles de documento One2many.");
    validateTransferSpec(spec, { ...source.contract, clientFields: source.clientFields, listFields: inverse ? Object.keys(source.metadata) : source.list.fields, customRepository: Boolean(source.declaration.repository), inverse });
    for (const [field, reference] of Object.entries({ ...spec.relations, ...spec.many2many })) {
      const owner = source.extensions.find(extension => extension.fields.includes(field) || extension.many2many?.some(item => item.field === field))?.module ?? source.module;
      checkReference({ byName, definitions }, owner, source, field, reference, `${source.id}.${field}`);
    }
    for (const [field, line] of Object.entries(spec.lines ?? {})) {
      const relation = source.contract.one2manyFields[field].one2many;
      const target = byName.get(relation.target);
      if (!target || target.module !== source.module) throw new Error(`${source.id}.${field}: transferencia requiere un hijo One2many registrado del mismo módulo.`);
      validate(target, line, depth + 1, relation.inverse);
    }
  }
  for (const definition of definitions) for (const source of definition.models) if (source.declaration.transfer) validate(source, source.declaration.transfer);
  return definitions;
}
