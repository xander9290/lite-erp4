import { listDeleteSelectionSchema, type ListDeleteResult, type ListDeleteTarget } from "@/lib/list/selection";

export type FormDeletion = {
  action: (selection: readonly ListDeleteTarget[]) => Promise<ListDeleteResult>;
  /** Safe fallback when the record was opened directly. */
  returnHref: string;
  /** Exact collection paths allowed in the untrusted returnTo parameter. */
  returnPaths?: readonly string[];
};

export class FormDeletionError extends Error {
  constructor(message: string, readonly kind: "validation" | "server" = "server") { super(message); }
}

export function formDeleteTarget(values: Record<string, unknown>): ListDeleteTarget | null {
  const result = listDeleteSelectionSchema.safeParse([{ id: values.id, revision: values.revision }]);
  return result.success ? result.data[0] : null;
}

const origin = "https://form.local";
function internalUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.length > 20000 || value !== value.trim() || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try { const url = new URL(value, origin); return url.origin === origin ? url : null; } catch { return null; }
}

export function formDeleteReturnHref(value: unknown, fallback: string, paths: readonly string[] = []): string {
  const base = internalUrl(fallback);
  if (!base) throw new FormDeletionError("Configura una ruta interna válida para volver.");
  const url = internalUrl(value);
  if (!url || ![base.pathname, ...paths].includes(url.pathname)) return fallback;
  return url.pathname + url.search + url.hash;
}

export async function deleteFormRecord(target: ListDeleteTarget, action: FormDeletion["action"]): Promise<void> {
  if (!formDeleteTarget(target)) throw new FormDeletionError("Recarga el registro antes de eliminarlo.", "validation");
  let result: ListDeleteResult;
  try { result = await action([target]); }
  catch { throw new FormDeletionError("No se pudo confirmar la eliminación. Recarga el registro antes de volver a intentarlo."); }
  if (result?.ok === false && typeof result.error === "string" && result.error.trim()) throw new FormDeletionError(result.error, result.kind ?? "server");
  if (!result?.ok || result.deleted !== 1) throw new FormDeletionError("No se pudo confirmar la eliminación. Recarga el registro antes de volver a intentarlo.");
}
