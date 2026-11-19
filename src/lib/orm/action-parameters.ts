import { z } from "zod";
import { isField, type Field, type FieldMetadata } from "./fields";
import { ActionParameterError } from "./context";

export type ActionParameterFields = Readonly<Record<string, Field>>;
export type ActionParams<T extends ActionParameterFields> = Readonly<{ [K in keyof T]: z.output<T[K]["schema"]> }>;
export type ActionParameterMetadata = Readonly<Record<string, FieldMetadata>>;
/** Public presentation only. Lookup IDs resolve registered, authorized server providers. */
export type ClientModelAction = { readonly name: string; readonly label: string; readonly params?: ActionParameterMetadata; readonly lookups?: Readonly<Record<string, string>> };
export type CompiledActionParameters = { readonly fields: ActionParameterFields; readonly metadata: ActionParameterMetadata; readonly schema: z.ZodType<Record<string, unknown>> };

export function compileActionParameters(fields: ActionParameterFields | undefined): CompiledActionParameters | undefined {
  if (fields === undefined) return undefined;
  if (!fields || typeof fields !== "object" || Array.isArray(fields) || !Object.keys(fields).length || Object.keys(fields).length > 8) throw new Error("params declara entre uno y ocho Fields.");
  for (const [name, field] of Object.entries(fields)) {
    if (!/^[a-z][A-Za-z0-9]*$/.test(name) || ["id", "revision", "root", "constructor", "prototype", "__proto__"].includes(name) || !isField(field)) throw new Error(`Parámetro inválido: ${name}. Usa Fields.`);
    const m = field.metadata;
    if (m.kind === "many2one" && m.domain) throw new Error(`${name}: los dominios de parámetros requieren un contrato de borrador propio; todavía no se admiten.`);
    if (m.kind === "image" || m.sequence || m.compute || m.related || m.sensitive || m.unique || m.tracking || m.defaultKind === "factory") throw new Error(`${name}: params admite Fields escalares/Many2one, sin imágenes, secuencias, virtuales, sensitive, unique, tracking ni defaults de función.`);
  }
  const copy = Object.freeze({ ...fields });
  return Object.freeze({ fields: copy, metadata: Object.freeze(Object.fromEntries(Object.entries(copy).map(([name, field]) => [name, field.metadata]))), schema: z.strictObject(Object.fromEntries(Object.entries(copy).map(([name, field]) => [name, field.schema]))) });
}

export function parseActionParameters(parameters: CompiledActionParameters | undefined, input: unknown): Record<string, unknown> {
  const supplied = input === undefined ? {} : input;
  if (!supplied || typeof supplied !== "object" || Array.isArray(supplied) || ![Object.prototype, null].includes(Object.getPrototypeOf(supplied)) || Object.values(Object.getOwnPropertyDescriptors(supplied)).some(descriptor => descriptor.get || descriptor.set)) throw new ActionParameterError("Los parámetros deben ser un objeto de valores.");
  const values = parameters ? { ...Object.fromEntries(Object.entries(parameters.fields).map(([name, field]) => [name, field.createDefault()])), ...supplied } : supplied;
  const result = (parameters?.schema ?? z.strictObject({})).safeParse(values);
  if (!result.success) throw new ActionParameterError("Revisa los parámetros de la acción.", Object.fromEntries(result.error.issues.map(issue => [issue.path.join(".") || "root", issue.message])));
  // Serialize only validated scalar values, never an untrusted toJSON callback.
  if (JSON.stringify(result.data).length > 16000) throw new ActionParameterError("Los parámetros superan el tamaño permitido.");
  return result.data;
}
