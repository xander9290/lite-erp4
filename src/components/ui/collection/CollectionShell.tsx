import Link from "next/link";
import { CircleAlert, Inbox, Plus, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import type { CollectionProps } from "./types";
import ListBreadcrumbs from "../list/ListBreadcrumbs";

export const internalCollectionHref = (href?: string) => Boolean(href && /^\/(?![\/\\])/.test(href));
export type CollectionHeaderSlots = { leading: ReactNode; actions: ReactNode };
export function CollectionShell({ title, breadcrumbs, createHref, createLabel = "Nuevo", headerActions, className = "", toolbar, children, footer, refresh, busy }: Pick<CollectionProps, "title" | "description" | "icon" | "breadcrumbs" | "createHref" | "createLabel" | "headerActions" | "className"> & { toolbar: (slots: CollectionHeaderSlots) => ReactNode; children: ReactNode; footer: ReactNode; refresh: () => void; busy?: boolean; count?: number }) {
  const leading = breadcrumbs?.length ? <div className="min-w-0 basis-48"><ListBreadcrumbs items={breadcrumbs} /></div> : null;
  const actions = <div className="order-3 ml-auto flex shrink-0 flex-wrap items-center gap-2 sm:order-4"><button type="button" className="btn btn-ghost btn-sm" onClick={refresh} disabled={busy} aria-label={`Actualizar ${title}`}><RefreshCw size={15} className={busy ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden="true" /><span className="hidden sm:inline">Actualizar</span></button>{headerActions}{internalCollectionHref(createHref) && <Link href={createHref!} className="btn btn-primary btn-sm gap-2"><Plus size={16} aria-hidden="true" />{createLabel}</Link>}</div>;
  return <section aria-label={title} className={`card flex min-h-0 min-w-0 w-full flex-1 flex-col rounded-2xl border border-base-300 bg-base-100 shadow-sm ${className}`}>
    <h2 className="sr-only">{title}</h2>
    <header data-slot="header" className="shrink-0 rounded-t-2xl border-b border-base-300 bg-linear-to-r from-primary/5 to-transparent px-2 py-2 sm:px-3">{toolbar({ leading, actions })}</header>
    {children}
    <footer className="shrink-0 rounded-b-2xl border-t border-base-300 bg-base-200/25 px-2 py-2 text-xs text-base-content/60 sm:px-3">{footer}</footer>
  </section>;
}
export function CollectionMessage({ error, retry, empty = "No hay registros", description = "Prueba con otros filtros o crea tu primer registro." }: { error?: string | null; retry?: () => void; empty?: string; description?: string }) {
  return <div role={error ? "alert" : "status"} className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center"><span className="flex size-12 items-center justify-center rounded-2xl bg-base-200 text-base-content/40">{error ? <CircleAlert size={26} aria-hidden="true" /> : <Inbox size={26} aria-hidden="true" />}</span><p className="max-w-md font-medium wrap-anywhere">{error ?? empty}</p>{!error && <p className="max-w-sm text-sm text-base-content/55">{description}</p>}{error && retry && <button type="button" className="btn btn-soft btn-sm" onClick={retry}>Reintentar</button>}</div>;
}

export function CollectionSkeleton({ title, breadcrumbs, className = "" }: Pick<CollectionProps, "title" | "breadcrumbs" | "className">) {
  return <section role="status" aria-label={`Cargando ${title}`} className={`card flex min-h-64 min-w-0 flex-1 flex-col rounded-2xl border border-base-300 bg-base-100 ${className}`}>
    <header className="flex min-w-0 flex-wrap items-center gap-2 border-b border-base-300 px-2 py-2 sm:px-3">{breadcrumbs?.length ? <div className="min-w-0 basis-48"><ListBreadcrumbs items={breadcrumbs} /></div> : null}<span aria-hidden="true" className="skeleton h-8 min-w-24 flex-1 motion-reduce:animate-none" /><span aria-hidden="true" className="skeleton size-8 motion-reduce:animate-none" /></header>
    <div aria-hidden="true" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-2 p-2 sm:p-3">{[1, 2, 3].map(id => <span key={id} className="skeleton h-24 rounded-xl motion-reduce:animate-none" />)}</div>
    <span className="sr-only">Cargando…</span>
  </section>;
}
