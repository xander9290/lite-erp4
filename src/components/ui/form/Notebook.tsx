"use client";

import { Children, Fragment, cloneElement, isValidElement, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import NotebookPage, { type NotebookPageProps } from "./NotebookPage";
import { NotebookContext, NotebookPolicyContext, notebookPageId, notebookTabId } from "./notebookContext";
import { renderInsertions, useInsertionAnchors } from "./insertions/Insertions";
import type { InsertionEntry, InsertionSlot } from "./insertions/resolve";

export type NotebookProps = {
  children?: ReactNode;
  /** Server Components pass page descriptors; elements are created in this client boundary. */
  pages?: readonly NotebookPageProps[];
  label?: string;
  id?: string;
  defaultPage?: string;
  activePage?: string;
  onPageChange?: (name: string) => void;
  className?: string;
};

function pagesFrom(children: ReactNode): ReactElement<NotebookPageProps>[] {
  return Children.toArray(children).flatMap(child => {
    if (isValidElement<{ children: ReactNode }>(child) && child.type === Fragment) return pagesFrom(child.props.children);
    if (!isValidElement<NotebookPageProps>(child) || child.type !== NotebookPage) throw new Error("Notebook solo admite NotebookPage como hijos (también dentro de fragments).");
    return [child];
  });
}

type Scope = Parameters<typeof renderInsertions>[1];

/** Pages contributed by extensions (`notebook:<id>` inside, `page:<id>/<name>` before/after/inside/replace). */
function withInsertedPages(own: ReactElement<NotebookPageProps>[], slots: Readonly<Record<string, InsertionSlot<ReactNode>>>, scope: Scope, id: string | undefined) {
  if (!id || !Object.keys(slots).length) return own;
  const inserted = (entries: readonly InsertionEntry<ReactNode>[], replaced?: string) => entries.flatMap(entry => {
    let pages: ReactElement<NotebookPageProps>[];
    try { pages = pagesFrom(entry.content); } catch { console.error(`[inserciones] ${entry.module}: ${entry.target} (${entry.position}) sólo admite NotebookPage.`); return []; }
    return pages.map(page => cloneElement(page, { children: renderInsertions([{ ...entry, content: page.props.children }], scope, replaced) }));
  });
  const merged = own.flatMap(page => {
    const target = `page:${id}/${page.props.name}`;
    const slot = slots[target];
    if (!slot) return [page];
    const self = slot.inside.length ? cloneElement(page, { children: <>{page.props.children}{renderInsertions(slot.inside, scope)}</> }) : page;
    return [...inserted(slot.before), ...(slot.replace ? inserted([slot.replace], target) : [self]), ...inserted(slot.after)];
  });
  const all = [...merged, ...inserted(slots[`notebook:${id}`]?.inside ?? [])];
  const seen = new Set<string>();
  return all.filter(page => {
    if (!seen.has(page.props.name)) { seen.add(page.props.name); return true; }
    console.error(`[inserciones] La página ${page.props.name} ya existe en el notebook ${id}; se omite la repetida.`);
    return false;
  });
}

export default function Notebook({ children, pages: declaredPages, label = "Secciones del formulario", id: providedId, defaultPage, activePage, onPageChange, className = "" }: NotebookProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const own = useMemo(() => {
    if (declaredPages !== undefined) {
      if (children != null) throw new Error("Notebook admite pages o children, no ambos.");
      return declaredPages.map(page => <NotebookPage key={page.name} {...page} />);
    }
    return pagesFrom(children);
  }, [children, declaredPages]);
  // With `id`, the notebook and its pages are insertion anchors for extensions.
  const anchorTargets = useMemo(() => providedId ? [`notebook:${providedId}`, ...own.map(page => `page:${providedId}/${page.props.name}`)] : [], [providedId, own]);
  const { slots, scope } = useInsertionAnchors(anchorTargets);
  const pages = useMemo(() => withInsertedPages(own, slots, scope, providedId), [own, slots, scope, providedId]);
  const around = providedId ? slots[`notebook:${providedId}`] : undefined;
  const names = pages.map(page => page.props.name);
  if (names.some(name => !name.trim()) || new Set(names).size !== names.length) throw new Error("Cada NotebookPage necesita un name único y no vacío.");
  // Pages hidden for the actor's groups: no tab and never activatable, but still mounted
  // (disabled) so values, drafts and validation stay intact. Only Notebooks with `id`.
  const policy = useContext(NotebookPolicyContext);
  const hidden = useMemo(() => new Set(providedId && policy?.hidden.size ? pages.map(page => page.props.name).filter(name => policy.hidden.has(`${providedId}/${name}`)) : []), [pages, policy, providedId]);
  const shown = useMemo(() => hidden.size ? pages.map(page => hidden.has(page.props.name) ? cloneElement(page, { disabled: true }) : page) : pages, [pages, hidden]);
  const visible = useMemo(() => shown.filter(page => !hidden.has(page.props.name)), [shown, hidden]);
  const enabled = useMemo(() => visible.filter(page => !page.props.disabled).map(page => page.props.name), [visible]);
  const namesKey = names.join("|");
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !providedId || !policy) return;
    const prefix = `${providedId}/`;
    const declared = [...policy.declared].filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length));
    if (!declared.length) return;
    const current = namesKey.split("|");
    const missing = declared.filter(name => !current.includes(name));
    const undeclared = current.filter(name => !declared.includes(name));
    if (missing.length) console.warn(`[páginas] El Notebook ${providedId} no pinta páginas declaradas en pages: ${missing.join(", ")}.`);
    if (undeclared.length) console.warn(`[páginas] El Notebook ${providedId} tiene páginas sin declarar en pages (no se pueden ocultar por grupo): ${undeclared.join(", ")}.`);
  }, [providedId, policy, namesKey]);
  const [internalPage, setInternalPage] = useState(defaultPage);
  const selected = activePage ?? internalPage;
  const active = selected && enabled.includes(selected) ? selected : enabled[0] ?? null;
  const [errorCounts, setErrorCounts] = useState<Record<string, number>>({});
  const tabs = useRef(new Map<string, HTMLDivElement>());
  const activate = useCallback((name: string) => {
    if (!enabled.includes(name) || name === active) return;
    if (activePage === undefined) setInternalPage(name);
    onPageChange?.(name);
  }, [enabled, active, activePage, onPageChange]);
  const reportErrors = useCallback((name: string, count: number) => {
    setErrorCounts(previous => (previous[name] ?? 0) === count ? previous : { ...previous, [name]: count });
  }, []);
  const context = useMemo(() => ({ id, active, activate, reportErrors }), [id, active, activate, reportErrors]);

  function focusTab(name: string) {
    activate(name);
    tabs.current.get(name)?.focus({ preventScroll: true });
    tabs.current.get(name)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  // Errors inside a hidden page: say so without naming the page or its fields.
  const hiddenErrors = [...hidden].some(name => (errorCounts[name] ?? 0) > 0);
  const hiddenNotice = hiddenErrors && <p role="alert" className="col-span-full flex items-start gap-2 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error"><CircleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />Hay datos con errores en una sección que no tienes disponible. Contacta a un administrador.</p>;
  // Every page hidden: no tablist or empty frame, only the mounted (hidden) panels.
  if (pages.length && !visible.length) return <>{around && renderInsertions(around.before, scope)}<NotebookContext.Provider value={context}>
    {hiddenNotice}<div hidden data-notebook-hidden="">{shown.map(page => <Fragment key={page.props.name}>{page}</Fragment>)}</div>
  </NotebookContext.Provider>{around && renderInsertions(around.after, scope)}</>;

  return <>{around && renderInsertions(around.before, scope)}<NotebookContext.Provider value={context}>
    {hiddenNotice}
    <section id={id} aria-label={label} className={`col-span-full min-w-0 scroll-mt-6 rounded-xl border border-base-300 bg-base-100 ${className}`}>
      <div className="min-w-0 overflow-x-auto rounded-t-xl border-b border-base-300 bg-base-200/40 px-2 pt-1">
        <div role="tablist" aria-label={label} aria-orientation="horizontal" className="tabs tabs-border w-max min-w-full flex-nowrap">
          {/* ARIA tabs stay navigable inside FormView's read-only disabled fieldset. */}
          {visible.map(({ props: page }) => <div key={page.name} ref={element => { if (element) tabs.current.set(page.name, element); else tabs.current.delete(page.name); }}
            id={notebookTabId(id, page.name)} role="tab" aria-selected={active === page.name} aria-controls={notebookPageId(id, page.name)}
            aria-disabled={page.disabled || undefined} tabIndex={active === page.name ? 0 : -1}
            className={`tab h-12 shrink-0 gap-2 px-3 text-sm font-medium outline-offset-[-4px] focus-visible:outline-2 focus-visible:outline-primary sm:px-4 ${active === page.name ? "tab-active text-primary" : "text-base-content/60"} ${page.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
            onClick={() => { if (!page.disabled) focusTab(page.name); }}
            onKeyDown={event => {
              if (page.disabled) return;
              const index = enabled.indexOf(page.name);
              const next = event.key === "ArrowRight" ? enabled[(index + 1) % enabled.length]
                : event.key === "ArrowLeft" ? enabled[(index - 1 + enabled.length) % enabled.length]
                : event.key === "Home" ? enabled[0] : event.key === "End" ? enabled.at(-1)
                : ["Enter", " "].includes(event.key) ? page.name : undefined;
              if (next) { event.preventDefault(); event.stopPropagation(); focusTab(next); }
            }}>
            {page.icon && <span aria-hidden="true" className="shrink-0">{page.icon}</span>}
            <span className="whitespace-nowrap">{page.label}</span>
            {page.badge != null && <span className="badge badge-ghost badge-sm">{page.badge}</span>}
            {errorCounts[page.name] > 0 && <span className="badge badge-soft badge-error badge-sm gap-1"><CircleAlert size={12} aria-hidden="true" /><span aria-label={`${errorCounts[page.name]} campos con error`}>{errorCounts[page.name]}</span></span>}
          </div>)}
        </div>
      </div>
      {shown.map(page => <Fragment key={page.props.name}>{page}</Fragment>)}
      {!active && <p className="p-5 text-sm text-base-content/60">No hay secciones disponibles.</p>}
    </section>
  </NotebookContext.Provider>{around && renderInsertions(around.after, scope)}</>;
}
