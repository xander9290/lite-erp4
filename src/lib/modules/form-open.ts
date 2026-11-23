import { z } from "zod";
import type { ModelClientConfig } from "./config";
import { fieldFromMetadata } from "./fields";
import type { Many2OneResult } from "../many2one/types";

const identity = z.string().trim().min(1).max(100);
const model = z.string().regex(/^[a-z][a-z0-9-]*\.[a-z][A-Za-z0-9]*$/).max(150);
const requestSchema = z.strictObject({
  model, view: z.enum(["modal", "form"]), id: identity.optional(),
  defaults: z.record(z.string(), z.unknown()).optional(),
  origin: z.strictObject({ model, id: identity }).optional(),
});

export class FormOpenError extends Error {}

/** Authorization happens before loading any view. Dependencies keep this policy independently testable. */
export async function prepareFormOpen(input: unknown, dependencies: {
  authorize: (model: string, id?: string) => Promise<ModelClientConfig>;
  readOrigin: (model: string, id: string) => Promise<void>;
  lookup: (model: string, field: string, defaults: Record<string, unknown>, id: string) => Promise<Many2OneResult>;
}) {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) throw new FormOpenError("La solicitud de formulario no es válida.");
  const request = parsed.data;
  if (request.origin) await dependencies.readOrigin(request.origin.model, request.origin.id);
  const config = await dependencies.authorize(request.model, request.id);
  // Editing always reads the persisted record; proposals have no effect, including stale ones.
  const defaults: Record<string, unknown> = {};
  if (!request.id && request.defaults) {
    if (JSON.stringify(request.defaults).length > 16000 || Object.keys(request.defaults).length > 50) throw new FormOpenError("Demasiados valores iniciales.");
    for (const [name, value] of Object.entries(request.defaults)) {
      const field = Object.hasOwn(config.fields, name) ? config.fields[name] : undefined;
      const access = config.fieldAccess?.[name];
      if (!field || ["id", "revision", "createBy"].includes(name) || field.readOnly || field.sequence || field.sensitive || field.compute || field.related || access?.noRead || access?.noWrite || access?.readOnly)
        throw new FormOpenError("Uno de los valores iniciales no está permitido.");
      const result = fieldFromMetadata(field).schema.safeParse(value);
      if (!result.success) throw new FormOpenError("Revisa los valores iniciales del formulario.");
      defaults[name] = result.data;
    }
    for (const [name, value] of Object.entries(defaults)) {
      if (config.fields[name].kind !== "many2one" || !value) continue;
      const result = await dependencies.lookup(request.model, name, defaults, String(value));
      if (!result.ok || !result.items.some(item => item.value === value && item.domainValid !== false)) throw new FormOpenError("Una referencia inicial no está disponible para este formulario.");
    }
  }
  return { config, view: request.view, ...(request.id ? { id: request.id } : {}), defaults };
}
