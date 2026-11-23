import type { ModuleModel } from "./define";

export type FormViewKind = "form" | "modal";

/** Resolve layout independently of presentation: a dialog may fall back to the page layout. */
export function resolveFormView(entry: Pick<ModuleModel, "id" | "views" | "extensions">, presentation: FormViewKind) {
  if (presentation === "form") return { kind: "form" as const, load: entry.views.form };
  const candidates = entry.extensions.filter(extension => extension.views?.modal);
  const winners = candidates.filter(candidate => !candidates.some(other => other !== candidate && other.depends?.includes(candidate.module)));
  if (winners.length > 1) throw new Error(`${entry.id}: vistas modal en conflicto entre ${winners.map(extension => extension.module).sort().join(", ")}. Declara una dependencia para elegir el override.`);
  const load = winners[0]?.views?.modal ?? entry.views.modal;
  return load ? { kind: "modal" as const, load } : { kind: "form" as const, load: entry.views.form };
}

/** A dedicated modal isolates page insertions; a fallback keeps them per extension. */
export function formExtensionContent(extensions: ModuleModel["extensions"], presentation: FormViewKind, layout: FormViewKind) {
  return extensions.map(extension => ({
    module: extension.module,
    form: layout === "form" && !(presentation === "modal" && extension.insertions?.modal) ? extension.views?.form : undefined,
    insertions: extension.insertions?.[presentation] ?? (presentation === "modal" && layout === "form" ? extension.insertions?.form : undefined),
  }));
}
