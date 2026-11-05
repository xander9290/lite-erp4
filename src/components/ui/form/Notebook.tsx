"use client";

import { Children, Fragment, isValidElement, useCallback, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import NotebookPage, { type NotebookPageProps } from "./NotebookPage";
import { NotebookContext, notebookPageId, notebookTabId } from "./notebookContext";

export type NotebookProps = {
  children: ReactNode;
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

export default function Notebook({ children, label = "Secciones del formulario", id: providedId, defaultPage, activePage, onPageChange, className = "" }: NotebookProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const pages = useMemo(() => pagesFrom(children), [children]);
  const names = pages.map(page => page.props.name);
  if (names.some(name => !name.trim()) || new Set(names).size !== names.length) throw new Error("Cada NotebookPage necesita un name único y no vacío.");
  const enabled = useMemo(() => pages.filter(page => !page.props.disabled).map(page => page.props.name), [pages]);
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

  return <NotebookContext.Provider value={context}>
    <section id={id} aria-label={label} className={`col-span-full min-w-0 scroll-mt-6 rounded-xl border border-base-300 bg-base-100 ${className}`}>
      <div className="min-w-0 overflow-x-auto rounded-t-xl border-b border-base-300 bg-base-200/40 px-2 pt-1">
        <div role="tablist" aria-label={label} aria-orientation="horizontal" className="tabs tabs-border w-max min-w-full flex-nowrap">
          {/* ARIA tabs stay navigable inside FormView's read-only disabled fieldset. */}
          {pages.map(({ props: page }) => <div key={page.name} ref={element => { if (element) tabs.current.set(page.name, element); else tabs.current.delete(page.name); }}
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
      {pages.map(page => <Fragment key={page.props.name}>{page}</Fragment>)}
      {!active && <p className="p-5 text-sm text-base-content/60">No hay secciones disponibles.</p>}
    </section>
  </NotebookContext.Provider>;
}
