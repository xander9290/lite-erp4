/** Browser-safe, generated references. They identify a target; they never grant access. */
import type { ModelClientConfig } from "./config";

declare const defaultsType: unique symbol;
export type ModelFormReference<Defaults extends object = object> = {
  readonly model: string;
  readonly [defaultsType]: Defaults;
};
export type FormDefaults<Reference extends ModelFormReference> = Reference[typeof defaultsType];
export type ModelFormSaved<Reference extends ModelFormReference> = Partial<FormDefaults<Reference>> & { id: string; revision: string };

export function defineModelFormReference<Defaults extends object>(model: string): ModelFormReference<Defaults> {
  if (!/^[a-z][a-z0-9-]*\.[a-z][A-Za-z0-9]*$/.test(model)) throw new Error("Referencia de formulario inválida.");
  return Object.freeze({ model }) as ModelFormReference<Defaults>;
}

export type ModelFormOpenRequest = {
  model: string;
  view: "modal" | "form";
  id?: string;
  defaults?: Readonly<Record<string, unknown>>;
  origin?: { model: string; id: string };
};

export type ModelFormOpenResult =
  | { ok: true; config: ModelClientConfig; view: "modal" | "form"; id?: string; defaults: Record<string, unknown> }
  | { ok: false; error: string };
