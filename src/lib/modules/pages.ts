/**
 * Notebook pages that groups may hide in a model's forms. The views are client TSX the server
 * cannot read, so the model declares them in its manifest: `pages: { <notebook id>: { <page
 * name>: "Etiqueta" } }`. Only declared pages can be hidden; everything else renders as before.
 * Hiding is presentation: field/data permissions and model validation stay independent.
 * Design and scope: docs/ideas/permisos-campos.md («Páginas por grupo»).
 */
export type ModelPages = Readonly<Record<string, Readonly<Record<string, string>>>>;
export const pageLayouts = ["form", "modal"] as const;
export type PageLayout = (typeof pageLayouts)[number];
export type CatalogPage = { readonly notebook: string; readonly page: string; readonly label: string; readonly module: string };
/** A stored exception: one page of one Notebook, in one screen and layout of a model. */
export type HiddenPage = { readonly model: string; readonly screen: string; readonly layout: string; readonly notebook: string; readonly page: string };
/**
 * `<notebook>/<page>` keys: the declared catalog (development checks) and, per layout, the
 * pages hidden for the actor in the screen being presented.
 */
export type HiddenPagesConfig = { readonly declared: readonly string[]; readonly form: readonly string[]; readonly modal: readonly string[] };

const identifier = /^[A-Za-z][A-Za-z0-9_-]{0,59}$/;
const maxNotebooks = 8;
const maxPages = 20;

export const pageKey = (notebook: string, page: string) => `${notebook}/${page}`;

/** Validate one declaration (the model's own or an extension's) and append it to `previous`. */
export function compilePages(where: string, module: string, pages: unknown, previous: readonly CatalogPage[] = []): readonly CatalogPage[] {
  if (pages === undefined) return previous;
  if (!pages || typeof pages !== "object" || Array.isArray(pages)) throw new Error(`${where}: pages es { <id del Notebook>: { <name de la página>: "Etiqueta" } }.`);
  const notebooks = Object.entries(pages);
  if (!notebooks.length || notebooks.length > maxNotebooks) throw new Error(`${where}: pages declara entre 1 y ${maxNotebooks} Notebooks.`);
  const result = [...previous];
  const known = new Map(previous.map(page => [pageKey(page.notebook, page.page), page.module]));
  for (const [notebook, entries] of notebooks) {
    if (!identifier.test(notebook)) throw new Error(`${where}: id de Notebook inválido en pages: ${notebook}. Usa el mismo id literal del <Notebook id>.`);
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw new Error(`${where}: pages.${notebook} es { <name>: "Etiqueta" }.`);
    const list = Object.entries(entries);
    if (!list.length || list.length > maxPages) throw new Error(`${where}: pages.${notebook} declara entre 1 y ${maxPages} páginas.`);
    for (const [page, label] of list) {
      if (!identifier.test(page)) throw new Error(`${where}: name de página inválido en pages.${notebook}: ${page}.`);
      if (typeof label !== "string" || !label.trim() || label.length > 80) throw new Error(`${where}: pages.${notebook}.${page} necesita una etiqueta de hasta 80 caracteres.`);
      const key = pageKey(notebook, page);
      const owner = known.get(key);
      if (owner) throw new Error(`${where}: la página ${key} ya la declara ${owner}.`);
      known.set(key, module);
      result.push(Object.freeze({ notebook, page, label: label.trim(), module }));
    }
  }
  return Object.freeze(result);
}

/** Hidden keys of one screen, per layout, restricted to the compiled catalog. */
export function hiddenPagesFor(model: string, catalog: readonly CatalogPage[], screen: string, hidden: readonly HiddenPage[] | undefined): HiddenPagesConfig {
  const declared = new Set(catalog.map(page => pageKey(page.notebook, page.page)));
  const pick = (layout: PageLayout) => [...new Set((hidden ?? [])
    .filter(row => row.model === model && row.screen === screen && row.layout === layout && declared.has(pageKey(row.notebook, row.page)))
    .map(row => pageKey(row.notebook, row.page)))].sort();
  return { declared: [...declared], form: pick("form"), modal: pick("modal") };
}
