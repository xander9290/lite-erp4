import { z } from "zod";
import { sequenceConfig, type SequenceOptions, type SequenceConfig } from "./sequence";
import { IMAGE_URL_MAX_LENGTH, imageUrlSchema, validateImageFolder } from "../uploads/image-policy";
import { declareRelationDomain, type RelationDomain, type DomainExpression } from "./domain-builder";

const many2manyTag = Symbol("orm.many2many");
export type Many2manyMetadata = { readonly target: string; readonly label?: string; readonly minSelected: number; readonly maxSelected: number; readonly invisible?: boolean; readonly domain?: DomainExpression };
export type Many2manyField = {
  readonly [many2manyTag]: true;
  readonly many2many: Many2manyMetadata;
  readonly schema: z.ZodType<string[], string[]>;
  createDefault(): string[];
};
export function isMany2many(value: unknown): value is Many2manyField {
  return Boolean(value && typeof value === "object" && many2manyTag in value);
}

const one2manyTag = Symbol("orm.one2many");
export type One2manyMetadata = { readonly target: string; readonly inverse: string; readonly label?: string; readonly minRows: number; readonly maxRows: number; readonly invisible?: boolean };
export type One2manyRow = Record<string, unknown> & { id?: string; revision?: string };
export type One2manyField<Row extends One2manyRow = One2manyRow> = {
  readonly [one2manyTag]: true;
  readonly one2many: One2manyMetadata;
  readonly schema: z.ZodType<Row[], Row[]>;
  createDefault(): Row[];
};
export function isOne2many(value: unknown): value is One2manyField {
  return Boolean(value && typeof value === "object" && one2manyTag in value);
}

const fieldTag = Symbol("orm.field");
export const INTEGER_MIN = -2147483648;
export const INTEGER_MAX = 2147483647;
type Default<T> = T | (() => T);
/** Collection presentation. The server service still fixes and validates the resulting list policy. */
type PresentationOptions = { list?: boolean; searchable?: boolean; sortable?: boolean; filterable?: boolean; groupable?: boolean };
type CommonOptions = { label?: string; required?: boolean; unique?: boolean; tracking?: boolean; sensitive?: boolean; invisible?: boolean } & PresentationOptions;
const presentationKeys = ["list", "searchable", "sortable", "filterable", "groupable"] as const;
type NullableOptions<T> = CommonOptions & { default?: Default<T | null> };
type RequiredValue<T, O> = O extends { sequence: SequenceOptions } | { required: true } ? T : T | null;

type CommonMetadata = {
  readonly sequence?: SequenceConfig;
  readonly invisible?: boolean;
  /** Generated presentation capability; not an editable Field option. */
  readonly readOnly?: boolean;
  readonly compute?: string;
  readonly related?: string;
  readonly label?: string;
  readonly required: boolean;
  readonly unique: boolean;
  readonly tracking?: boolean;
  readonly sensitive?: boolean;
  readonly defaultKind: "empty" | "literal" | "factory";
  readonly defaultValue?: string | number | boolean | null;
  /** Explicit collection presentation; absent keys use the module defaults. */
  readonly list?: boolean;
  readonly searchable?: boolean;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly groupable?: boolean;
};
export type SelectionOption = { readonly value: string; readonly label: string };
export type FieldMetadata = CommonMetadata & (
  | { readonly kind: "text"; readonly trim: boolean; readonly minLength?: number; readonly maxLength?: number; readonly writeOnly?: boolean }
  | { readonly kind: "image"; readonly folder: string; readonly maxLength: number }
  | { readonly kind: "integer"; readonly min?: number; readonly max?: number }
  | { readonly kind: "boolean" }
  | { readonly kind: "selection"; readonly choices: readonly SelectionOption[] }
  | { readonly kind: "datetime" }
  // Cascade is internal: only the companion link of a model extension uses it (never Fields.Many2one).
  | { readonly kind: "many2one"; readonly target: string; readonly onDelete: "Restrict" | "SetNull" | "Cascade"; readonly domain?: DomainExpression }
);
type FieldDetails<T = FieldMetadata> = T extends FieldMetadata ? Omit<T, keyof CommonMetadata> : never;

/** A declaration describes data; it is not an instance's persisted field value. */
export type Field<TInput = unknown, TOutput = unknown> = {
  readonly [fieldTag]: true;
  readonly metadata: FieldMetadata;
  readonly schema: z.ZodType<TOutput, TInput>;
  createDefault(): TInput;
};
type DeclaredField<I, V, O> = O extends { compute: string } ? Field<I, V> & { readonly compute: string } : O extends { related: string } ? Field<I, V> & { readonly related: string } : Field<I, V>;

export function isField(value: unknown): value is Field {
  return typeof value === "object" && value !== null && fieldTag in value && value[fieldTag] === true;
}

function checkOptions(options: CommonOptions, extra: readonly string[]) {
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("Las opciones del Field deben ser un objeto.");
  const allowed = new Set(["label", "required", "unique", "default", "tracking", "sensitive", "invisible", ...presentationKeys, ...extra]);
  for (const key of Object.keys(options)) if (!allowed.has(key)) throw new Error(`Opción de Field desconocida: ${key}.`);
  if (options.label !== undefined && (typeof options.label !== "string" || !options.label.trim())) throw new Error("El label del Field no puede estar vacío.");
  for (const key of ["required", "unique", "tracking", "sensitive", "invisible", ...presentationKeys] as const) if (options[key] !== undefined && typeof options[key] !== "boolean") throw new Error(`${key} debe ser booleano.`);
  if (options.sensitive && options.tracking) throw new Error("Un campo sensible no puede habilitar tracking.");
  if (options.sensitive && presentationKeys.some(key => options[key])) throw new Error("Un campo sensible no se publica en colecciones: sin list, searchable, sortable, filterable ni groupable.");
}

function checkBounds(min: number | undefined, max: number | undefined, lengths = false) {
  for (const bound of [min, max]) {
    if (bound !== undefined && (!Number.isSafeInteger(bound) || (lengths && bound < 0))) throw new Error("Los límites deben ser enteros seguros y las longitudes no pueden ser negativas.");
  }
  if (min !== undefined && max !== undefined && min > max) throw new Error("El límite mínimo no puede superar al máximo.");
}

function makeField<I, O>(schema: z.ZodType<O, I>, options: CommonOptions & { default?: unknown; related?: string; compute?: string; sequence?: SequenceConfig }, empty: I, details: FieldDetails): Field<I, O> {
  if (options.compute !== undefined) {
    if (typeof options.compute !== "string" || !/^[a-z][A-Za-z0-9]*$/.test(options.compute) || ["constructor", "prototype", "__proto__"].includes(options.compute)) throw new Error("compute necesita el nombre de un método de instancia.");
    if (options.related !== undefined || options.unique || options.tracking || options.sensitive || Object.hasOwn(options, "default")) throw new Error("compute es virtual de lectura: sin related, unique, tracking, sensitive ni default.");
  }
  if (options.related !== undefined) {
    if (typeof options.related !== "string") throw new Error("related necesita una ruta de texto.");
    const parts = options.related.split(".");
    if (parts.length < 2 || parts.length > 4 || parts.some(part => !/^[a-z][A-Za-z0-9]*$/.test(part) || ["constructor", "prototype", "__proto__"].includes(part))) throw new Error("related necesita una ruta Many2one de hasta tres saltos.");
    if (options.required || options.unique || options.tracking || options.sensitive || Object.hasOwn(options, "default")) throw new Error("related es de lectura: sin required, unique, tracking, sensitive ni default.");
  }
  if ((options.related !== undefined || options.compute !== undefined) && (options.searchable || options.sortable || options.filterable || options.groupable)) throw new Error("Un campo virtual sólo admite list: no se busca, ordena, filtra ni agrupa en SQL.");
  if (options.searchable && details.kind !== "text") throw new Error("searchable sólo aplica a campos Text.");
  if ((options.sortable || options.filterable) && details.kind === "image") throw new Error("Una imagen no se ordena ni se filtra.");
  if (options.groupable && (details.kind === "image" || details.kind === "datetime")) throw new Error("groupable no admite imágenes ni fechas (sin agrupación por periodos todavía).");
  const hasDefault = Object.hasOwn(options, "default");
  const configuredDefault = options.default;
  const validateDefault = (value: unknown) => {
    if (!schema.safeParse(value).success) throw new Error(`Valor inicial inválido en ${options.label ?? details.kind}.`);
  };
  if (hasDefault && typeof configuredDefault !== "function") validateDefault(configuredDefault);
  const metadata = Object.freeze({
    ...details, label: options.label, required: options.required === true, unique: options.unique === true,
    ...(options.tracking !== undefined ? { tracking: options.tracking } : {}),
    ...(options.sensitive !== undefined ? { sensitive: options.sensitive } : {}),
    ...(options.invisible !== undefined ? { invisible: options.invisible } : {}),
    ...(options.related ? { related: options.related } : {}),
    ...(options.compute ? { compute: options.compute } : {}),
    ...(options.sequence ? { sequence: options.sequence } : {}),
    defaultKind: !hasDefault ? "empty" : typeof configuredDefault === "function" ? "factory" : "literal",
    ...(hasDefault && typeof configuredDefault !== "function" ? { defaultValue: configuredDefault } : {}),
    ...Object.fromEntries(presentationKeys.filter(key => options[key] !== undefined).map(key => [key, options[key]])),
  }) as FieldMetadata;
  return Object.freeze({
    [fieldTag]: true as const, metadata, schema, ...(options.related ? { related: options.related } : {}), ...(options.compute ? { compute: options.compute } : {}),
    createDefault() {
      if (!hasDefault) return empty;
      const value: unknown = typeof configuredDefault === "function" ? configuredDefault() : configuredDefault;
      validateDefault(value);
      // These scalar factories validate that explicit defaults belong to their input domain.
      return value as I;
    },
  });
}

function nullableString(value: string | null) { return value === "" ? null : value; }
type TextOptions = NullableOptions<string> & { sequence?: SequenceOptions; minLength?: number; maxLength?: number; trim?: boolean; related?: string; compute?: string;
  /** Secret written by the server (e.g. hashed) and never read back nor published: implies sensitive. */
  writeOnly?: boolean };
type ImageOptions = NullableOptions<string> & { maxLength?: number; compute?: string } & ({ folder: string; related?: string } | { related: string; folder?: string } | { compute: string; folder?: string; related?: string });
type IntegerOptions = NullableOptions<number> & { min?: number; max?: number; compute?: string };
type BooleanOptions = Omit<CommonOptions, "required"> & { default?: Default<boolean> };
type Many2oneOptions = NullableOptions<string> & { onDelete?: "Restrict" | "SetNull"; domain?: RelationDomain };

/**
 * Read-only relation (`Fields.One2many(target, { inverse, readonly: true })`): children shown as
 * a paginated, authorized collection in the parent's form. Never part of the document (RHF, Zod,
 * save, revision); children are created and edited in their own form. No row limit.
 */
const collectionTag = Symbol("orm.childCollection");
export type ChildCollectionMetadata = { readonly target: string; readonly inverse: string; readonly label?: string; readonly invisible?: boolean };
export type ChildCollectionField = { readonly [collectionTag]: true; readonly collection: ChildCollectionMetadata };
export function isChildCollection(value: unknown): value is ChildCollectionField {
  return Boolean(value && typeof value === "object" && collectionTag in value);
}
type One2manyOptions = { inverse: string; label?: string; minRows?: number; maxRows?: number; invisible?: boolean; readonly?: false };
type ChildCollectionOptions = { inverse: string; label?: string; invisible?: boolean; readonly: true };
function one2many(target: string, options: ChildCollectionOptions): ChildCollectionField;
function one2many<Row extends One2manyRow = One2manyRow>(target: string, options: One2manyOptions): One2manyField<Row>;
function one2many<Row extends One2manyRow = One2manyRow>(target: string, input: One2manyOptions | ChildCollectionOptions): One2manyField<Row> | ChildCollectionField {
  if (input && typeof input === "object" && (input as { readonly?: unknown }).readonly === true) {
    const keys = ["inverse", "label", "invisible", "readonly"];
    if (!/^[A-Z][A-Za-z0-9]*$/.test(target) || Object.keys(input).some(key => !keys.includes(key)) || typeof input.inverse !== "string" || !/^[a-z][A-Za-z0-9]*$/.test(input.inverse) || (input.label !== undefined && (typeof input.label !== "string" || !input.label.trim())) || (input.invisible !== undefined && typeof input.invisible !== "boolean")) throw new Error("Una relación de consulta necesita destino, Many2one inverso y label válidos; no admite minRows/maxRows.");
    return Object.freeze({ [collectionTag]: true as const, collection: Object.freeze({ target, inverse: input.inverse, ...(input.label !== undefined ? { label: input.label } : {}), ...(input.invisible !== undefined ? { invisible: input.invisible } : {}) }) });
  }
  if (input && typeof input === "object" && (input as { readonly?: unknown }).readonly !== undefined && (input as { readonly?: unknown }).readonly !== false) throw new Error("readonly sólo admite true o false.");
  const { readonly: _readonly, ...options } = (input ?? {}) as One2manyOptions;
  void _readonly;
    if (!/^[A-Z][A-Za-z0-9]*$/.test(target) || !options || typeof options !== "object" || Array.isArray(options) || typeof options.inverse !== "string" || Object.keys(options).some(key => !["inverse", "label", "minRows", "maxRows", "invisible"].includes(key)) || !/^[a-z][A-Za-z0-9]*$/.test(options.inverse) || ["id", "revision", "createBy", "constructor", "prototype", "__proto__"].includes(options.inverse)) throw new Error("One2many necesita un modelo destino y un Many2one inverso válidos.");
    const minRows = options.minRows ?? 0, maxRows = options.maxRows ?? 50;
    if (!Number.isSafeInteger(minRows) || !Number.isSafeInteger(maxRows) || minRows < 0 || maxRows < 1 || maxRows > 100 || minRows > maxRows || (options.label !== undefined && (typeof options.label !== "string" || !options.label.trim())) || (options.invisible !== undefined && typeof options.invisible !== "boolean")) throw new Error("One2many admite entre 0 y 100 líneas, con límites y label válidos.");
    return Object.freeze({ [one2manyTag]: true as const, one2many: Object.freeze({ target, inverse: options.inverse, minRows, maxRows, ...(options.label !== undefined ? { label: options.label } : {}), ...(options.invisible !== undefined ? { invisible: options.invisible } : {}) }), schema: z.array(z.record(z.string(), z.unknown())).min(minRows).max(maxRows) as z.ZodType<Row[], Row[]>, createDefault: () => [] });
}

export const Fields = Object.freeze({
  Image<const O extends ImageOptions>(options: O): DeclaredField<string | null, RequiredValue<string, O>, O> {
    checkOptions(options, ["folder", "maxLength", "related", "compute"]);
    const folder = validateImageFolder(options.related || options.compute ? options.folder ?? (options.related ? "related" : "computed") : options.folder!);
    const maxLength = options.maxLength ?? IMAGE_URL_MAX_LENGTH;
    checkBounds(1, maxLength, true);
    if (maxLength > IMAGE_URL_MAX_LENGTH) throw new Error(`Image admite URLs de hasta ${IMAGE_URL_MAX_LENGTH} caracteres.`);
    const value = imageUrlSchema(options.label, maxLength);
    const schema = z.string().nullable().transform(text => nullableString(text?.trim() ?? null))
      .pipe(options.required ? value : value.nullable());
    return makeField(schema as z.ZodType<RequiredValue<string, O>, string | null>, options, null, { kind: "image", folder, maxLength }) as DeclaredField<string | null, RequiredValue<string, O>, O>;
  },

  Text<const O extends TextOptions = Record<never, never>>(options: O = {} as O): DeclaredField<string | null, RequiredValue<string, O>, O> {
    checkOptions(options, ["minLength", "maxLength", "trim", "related", "compute", "sequence", "writeOnly"]);
    if (options.writeOnly !== undefined && options.writeOnly !== true) throw new Error("writeOnly sólo admite true.");
    if (options.writeOnly && (options.required || options.unique || options.tracking || options.sequence || options.related !== undefined || options.compute !== undefined || Object.hasOwn(options, "default") || presentationKeys.some(key => options[key]))) throw new Error("writeOnly es un secreto opcional: sin required, unique, tracking, default, sequence, related, compute ni opciones de colección.");
    const sequence = options.sequence === undefined ? undefined : sequenceConfig(options.sequence);
    if (sequence) {
      if (options.required === false || options.unique === false || options.sensitive || options.related !== undefined || options.compute !== undefined || Object.hasOwn(options, "default") || options.trim === false || options.minLength !== undefined) throw new Error("sequence es obligatorio, único y generado: sin default, sensitive, related, compute, minLength ni trim:false.");
      const length = sequence.prefix.replaceAll("{year}", "2000").length + sequence.padding;
      if (options.maxLength !== undefined && options.maxLength < length) throw new Error("maxLength no permite el formato del folio.");
    }
    const settings = { ...options, ...(sequence ? { required: true, unique: true } : {}), ...(options.writeOnly ? { sensitive: true } : {}), sequence };
    checkBounds(settings.minLength, settings.maxLength, true);
    if (settings.required && settings.maxLength === 0) throw new Error("Un texto obligatorio debe permitir al menos un carácter.");
    if (settings.trim !== undefined && typeof settings.trim !== "boolean") throw new Error("trim debe ser booleano.");
    const label = settings.label ?? "Texto";
    const trim = settings.trim !== false;
    let value = z.string();
    if (settings.minLength !== undefined) value = value.min(settings.minLength, `${label}: mínimo ${settings.minLength} caracteres.`);
    if (settings.maxLength !== undefined) value = value.max(settings.maxLength, `${label}: máximo ${settings.maxLength} caracteres.`);
    const nonempty = z.string({ error: `${label}: campo obligatorio.` }).min(1, `${label}: campo obligatorio.`).pipe(value);
    const schema = z.string({ error: `${label}: escribe un texto válido.` }).nullable().transform(text => nullableString(trim ? text?.trim() ?? null : text))
      .pipe(settings.required ? nonempty : value.nullable());
    return makeField(schema as z.ZodType<RequiredValue<string, O>, string | null>, settings, "", { kind: "text", trim: settings.trim !== false, minLength: settings.minLength, maxLength: settings.maxLength, ...(options.writeOnly ? { writeOnly: true } : {}) }) as DeclaredField<string | null, RequiredValue<string, O>, O>;
  },

  Integer<const O extends IntegerOptions = Record<never, never>>(options: O = {} as O): DeclaredField<number | null, RequiredValue<number, O>, O> {
    checkOptions(options, ["min", "max", "compute"]);
    checkBounds(options.min, options.max);
    if ([options.min, options.max].some(bound => bound !== undefined && (bound < INTEGER_MIN || bound > INTEGER_MAX))) throw new Error("Integer usa el rango de Int de Prisma (32 bits).");
    const label = options.label ?? "Número";
    let value = z.number({ error: `${label}: escribe un número entero.` }).int(`${label}: debe ser un entero seguro.`)
      .min(INTEGER_MIN, `${label}: fuera del rango de un entero de 32 bits.`).max(INTEGER_MAX, `${label}: fuera del rango de un entero de 32 bits.`);
    if (options.min !== undefined) value = value.min(options.min, `${label}: mínimo ${options.min}.`);
    if (options.max !== undefined) value = value.max(options.max, `${label}: máximo ${options.max}.`);
    const schema = z.number({ error: `${label}: escribe un número entero.` }).nullable().pipe(options.required ? value : value.nullable());
    return makeField(schema as z.ZodType<RequiredValue<number, O>, number | null>, options, null, { kind: "integer", min: options.min, max: options.max }) as DeclaredField<number | null, RequiredValue<number, O>, O>;
  },

  Boolean(options: BooleanOptions = {}): Field<boolean, boolean> {
    checkOptions(options, []);
    if (Object.hasOwn(options, "required")) throw new Error("Boolean siempre recibe true o false; required no significa que deba estar activado.");
    return makeField(z.boolean({ error: `${options.label ?? "Booleano"}: usa true o false.` }), { default: false, ...options, required: true }, false, { kind: "boolean" });
  },

  Selection<const C extends readonly [SelectionOption, ...SelectionOption[]], const O extends NullableOptions<C[number]["value"]> = Record<never, never>>(choices: C, options: O = {} as O): Field<C[number]["value"] | null, RequiredValue<C[number]["value"], O>> {
    checkOptions(options, []);
    if (!Array.isArray(choices) || !choices.length || choices.some(choice => !choice || typeof choice.value !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(choice.value) || typeof choice.label !== "string" || !choice.label.trim()) || new Set(choices.map(choice => choice.value)).size !== choices.length) {
      throw new Error("Selection requiere valores únicos con identificadores válidos y etiquetas no vacías.");
    }
    const value = z.enum(choices.map(choice => choice.value) as [C[number]["value"], ...C[number]["value"][]], { error: `${options.label ?? "Selección"}: elige una opción válida.` });
    const schema = value.nullable().pipe(options.required ? value : value.nullable());
    const safeChoices = Object.freeze(choices.map(choice => Object.freeze({ value: choice.value, label: choice.label })));
    return makeField(schema as z.ZodType<RequiredValue<C[number]["value"], O>, C[number]["value"] | null>, options, null, { kind: "selection", choices: safeChoices });
  },

  DateTime<const O extends NullableOptions<string> = Record<never, never>>(options: O = {} as O): Field<string | null, RequiredValue<string, O>> {
    checkOptions(options, []);
    const value = z.iso.datetime({ error: `${options.label ?? "Fecha y hora"}: usa un ISO UTC válido.` });
    const schema = z.string().nullable().transform(nullableString).pipe(options.required ? value : value.nullable());
    return makeField(schema as z.ZodType<RequiredValue<string, O>, string | null>, options, null, { kind: "datetime" });
  },

  Many2many(target: string, options: { label?: string; minSelected?: number; maxSelected?: number; invisible?: boolean; domain?: RelationDomain } = {}): Many2manyField {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(target) || !options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some(key => !["label", "minSelected", "maxSelected", "invisible", "domain"].includes(key))) throw new Error("Many2many necesita un modelo destino y opciones válidas.");
    const minSelected = options.minSelected ?? 0, maxSelected = options.maxSelected ?? 100;
    if (!Number.isSafeInteger(minSelected) || !Number.isSafeInteger(maxSelected) || minSelected < 0 || maxSelected < 1 || maxSelected > 100 || minSelected > maxSelected || (options.label !== undefined && (typeof options.label !== "string" || !options.label.trim())) || (options.invisible !== undefined && typeof options.invisible !== "boolean")) throw new Error("Many2many admite entre 0 y 100 selecciones, con límites y label válidos.");
    const schema = z.array(z.string().min(1).max(100).refine(id => id.trim() === id, "ID inválido.")).min(minSelected).max(maxSelected).refine(ids => new Set(ids).size === ids.length, "La selección contiene IDs duplicados.");
    const domain = declareRelationDomain(options.domain);
    return Object.freeze({ [many2manyTag]: true as const, many2many: Object.freeze({ target, minSelected, maxSelected, ...(domain ? { domain } : {}), ...(options.label !== undefined ? { label: options.label } : {}), ...(options.invisible !== undefined ? { invisible: options.invisible } : {}) }), schema, createDefault: () => [] });
  },

  One2many: one2many,

  Many2one<const O extends Many2oneOptions = Record<never, never>>(target: string, options: O & { domain?: RelationDomain } = {} as O): Field<string | null, RequiredValue<string, O>> {
    checkOptions(options, ["onDelete", "domain"]);
    if (!/^[A-Z][A-Za-z0-9]*$/.test(target)) throw new Error("Many2one necesita el nombre de un modelo, por ejemplo Partner.");
    const onDelete = options.onDelete ?? "Restrict";
    if (!["Restrict", "SetNull"].includes(onDelete) || (options.required && onDelete === "SetNull")) throw new Error("La política de borrado no es compatible con esta relación.");
    const value = z.string({ error: `${options.label ?? target}: selecciona un registro.` }).min(1, `${options.label ?? target}: selecciona un registro.`).max(100);
    const schema = z.string().nullable().transform(id => nullableString(id?.trim() ?? null)).pipe(options.required ? value : value.nullable());
    const domain = declareRelationDomain(options.domain);
    return makeField(schema as z.ZodType<RequiredValue<string, O>, string | null>, options, null, { kind: "many2one", target, onDelete, ...(domain ? { domain } : {}) });
  },
});
