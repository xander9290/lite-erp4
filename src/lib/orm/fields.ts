import { z } from "zod";

const fieldTag = Symbol("orm.field");
export const INTEGER_MIN = -2147483648;
export const INTEGER_MAX = 2147483647;
type Default<T> = T | (() => T);
type CommonOptions = { label?: string; required?: boolean; unique?: boolean };
type NullableOptions<T> = CommonOptions & { default?: Default<T | null> };
type RequiredValue<T, O> = O extends { required: true } ? T : T | null;

type CommonMetadata = {
  readonly label?: string;
  readonly required: boolean;
  readonly unique: boolean;
  readonly defaultKind: "empty" | "literal" | "factory";
  readonly defaultValue?: string | number | boolean | null;
};
export type SelectionOption = { readonly value: string; readonly label: string };
export type FieldMetadata = CommonMetadata & (
  | { readonly kind: "text"; readonly trim: boolean; readonly minLength?: number; readonly maxLength?: number }
  | { readonly kind: "integer"; readonly min?: number; readonly max?: number }
  | { readonly kind: "boolean" }
  | { readonly kind: "selection"; readonly choices: readonly SelectionOption[] }
  | { readonly kind: "datetime" }
  | { readonly kind: "many2one"; readonly target: string; readonly onDelete: "Restrict" | "SetNull" }
);
type FieldDetails<T = FieldMetadata> = T extends FieldMetadata ? Omit<T, keyof CommonMetadata> : never;

/** A declaration describes data; it is not an instance's persisted field value. */
export type Field<TInput = unknown, TOutput = unknown> = {
  readonly [fieldTag]: true;
  readonly metadata: FieldMetadata;
  readonly schema: z.ZodType<TOutput, TInput>;
  createDefault(): TInput;
};

export function isField(value: unknown): value is Field {
  return typeof value === "object" && value !== null && fieldTag in value && value[fieldTag] === true;
}

function checkOptions(options: CommonOptions, extra: readonly string[]) {
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("Las opciones del Field deben ser un objeto.");
  const allowed = new Set(["label", "required", "unique", "default", ...extra]);
  for (const key of Object.keys(options)) if (!allowed.has(key)) throw new Error(`Opción de Field desconocida: ${key}.`);
  if (options.label !== undefined && (typeof options.label !== "string" || !options.label.trim())) throw new Error("El label del Field no puede estar vacío.");
  for (const key of ["required", "unique"] as const) if (options[key] !== undefined && typeof options[key] !== "boolean") throw new Error(`${key} debe ser booleano.`);
}

function checkBounds(min: number | undefined, max: number | undefined, lengths = false) {
  for (const bound of [min, max]) {
    if (bound !== undefined && (!Number.isSafeInteger(bound) || (lengths && bound < 0))) throw new Error("Los límites deben ser enteros seguros y las longitudes no pueden ser negativas.");
  }
  if (min !== undefined && max !== undefined && min > max) throw new Error("El límite mínimo no puede superar al máximo.");
}

function makeField<I, O>(schema: z.ZodType<O, I>, options: CommonOptions & { default?: unknown }, empty: I, details: FieldDetails): Field<I, O> {
  const hasDefault = Object.hasOwn(options, "default");
  const configuredDefault = options.default;
  const validateDefault = (value: unknown) => {
    if (!schema.safeParse(value).success) throw new Error(`Valor inicial inválido en ${options.label ?? details.kind}.`);
  };
  if (hasDefault && typeof configuredDefault !== "function") validateDefault(configuredDefault);
  const metadata = Object.freeze({
    ...details, label: options.label, required: options.required === true, unique: options.unique === true,
    defaultKind: !hasDefault ? "empty" : typeof configuredDefault === "function" ? "factory" : "literal",
    ...(hasDefault && typeof configuredDefault !== "function" ? { defaultValue: configuredDefault } : {}),
  }) as FieldMetadata;
  return Object.freeze({
    [fieldTag]: true as const, metadata, schema,
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
type TextOptions = NullableOptions<string> & { minLength?: number; maxLength?: number; trim?: boolean };
type IntegerOptions = NullableOptions<number> & { min?: number; max?: number };
type BooleanOptions = Omit<CommonOptions, "required"> & { default?: Default<boolean> };
type Many2oneOptions = NullableOptions<string> & { onDelete?: "Restrict" | "SetNull" };

export const Fields = Object.freeze({
  Text<const O extends TextOptions = Record<never, never>>(options: O = {} as O): Field<string | null, RequiredValue<string, O>> {
    checkOptions(options, ["minLength", "maxLength", "trim"]);
    checkBounds(options.minLength, options.maxLength, true);
    if (options.required && options.maxLength === 0) throw new Error("Un texto obligatorio debe permitir al menos un carácter.");
    if (options.trim !== undefined && typeof options.trim !== "boolean") throw new Error("trim debe ser booleano.");
    const label = options.label ?? "Texto";
    const trim = options.trim !== false;
    let value = z.string();
    if (options.minLength !== undefined) value = value.min(options.minLength, `${label}: mínimo ${options.minLength} caracteres.`);
    if (options.maxLength !== undefined) value = value.max(options.maxLength, `${label}: máximo ${options.maxLength} caracteres.`);
    const nonempty = z.string({ error: `${label}: campo obligatorio.` }).min(1, `${label}: campo obligatorio.`).pipe(value);
    const schema = z.string({ error: `${label}: escribe un texto válido.` }).nullable().transform(text => nullableString(trim ? text?.trim() ?? null : text))
      .pipe(options.required ? nonempty : value.nullable());
    return makeField(schema as z.ZodType<RequiredValue<string, O>, string | null>, options, "", { kind: "text", trim: options.trim !== false, minLength: options.minLength, maxLength: options.maxLength });
  },

  Integer<const O extends IntegerOptions = Record<never, never>>(options: O = {} as O): Field<number | null, RequiredValue<number, O>> {
    checkOptions(options, ["min", "max"]);
    checkBounds(options.min, options.max);
    if ([options.min, options.max].some(bound => bound !== undefined && (bound < INTEGER_MIN || bound > INTEGER_MAX))) throw new Error("Integer usa el rango de Int de Prisma (32 bits).");
    const label = options.label ?? "Número";
    let value = z.number({ error: `${label}: escribe un número entero.` }).int(`${label}: debe ser un entero seguro.`)
      .min(INTEGER_MIN, `${label}: fuera del rango de un entero de 32 bits.`).max(INTEGER_MAX, `${label}: fuera del rango de un entero de 32 bits.`);
    if (options.min !== undefined) value = value.min(options.min, `${label}: mínimo ${options.min}.`);
    if (options.max !== undefined) value = value.max(options.max, `${label}: máximo ${options.max}.`);
    const schema = z.number({ error: `${label}: escribe un número entero.` }).nullable().pipe(options.required ? value : value.nullable());
    return makeField(schema as z.ZodType<RequiredValue<number, O>, number | null>, options, null, { kind: "integer", min: options.min, max: options.max });
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

  Many2one<const O extends Many2oneOptions = Record<never, never>>(target: string, options: O = {} as O): Field<string | null, RequiredValue<string, O>> {
    checkOptions(options, ["onDelete"]);
    if (!/^[A-Z][A-Za-z0-9]*$/.test(target)) throw new Error("Many2one necesita el nombre de un modelo, por ejemplo Partner.");
    const onDelete = options.onDelete ?? "Restrict";
    if (!["Restrict", "SetNull"].includes(onDelete) || (options.required && onDelete === "SetNull")) throw new Error("La política de borrado no es compatible con esta relación.");
    const value = z.string({ error: `${options.label ?? target}: selecciona un registro.` }).min(1, `${options.label ?? target}: selecciona un registro.`).max(100);
    const schema = z.string().nullable().transform(id => nullableString(id?.trim() ?? null)).pipe(options.required ? value : value.nullable());
    return makeField(schema as z.ZodType<RequiredValue<string, O>, string | null>, options, null, { kind: "many2one", target, onDelete });
  },
});
