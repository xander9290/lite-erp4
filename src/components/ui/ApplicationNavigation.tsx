"use client";

import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { NavigationGuardLink } from "nextjs-nav-guard";
import { ChevronDown, Menu } from "lucide-react";
import { activeApplication, activeApplicationMenu, type ApplicationNavigation as Navigation } from "@/lib/applications/navigation";
import type { ApplicationMenuLink } from "@/lib/applications/manifest";

const CloseDropdown = createContext<(() => void) | undefined>(undefined);

function NavigationDropdown({ label, accessibleLabel, active = false, children }: {
  label: ReactNode; accessibleLabel: string; active?: boolean; children: ReactNode;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const id = useId();
  function close() {
    if (!root.current?.open) return;
    root.current.open = false;
    trigger.current?.focus();
  }
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node) && root.current) root.current.open = false; };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return <details ref={root} className="dropdown min-w-0" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null) && root.current) root.current.open = false;
  }} onKeyDown={event => {
    if (event.key === "Escape" && root.current?.open) { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <summary ref={trigger} aria-label={accessibleLabel} aria-controls={id} className={`btn btn-sm h-auto min-h-8 max-w-full gap-1.5 py-1.5 text-left whitespace-normal ${active ? "btn-soft btn-primary" : "btn-ghost"}`}>
      {label}<ChevronDown size={13} className="shrink-0" aria-hidden="true" />
    </summary>
    <div id={id} className="dropdown-content z-50 mt-2 max-h-[min(65dvh,28rem)] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-2 shadow-xl"><CloseDropdown.Provider value={close}>{children}</CloseDropdown.Provider></div>
  </details>;
}

function MenuLink({ item, activeId }: { item: ApplicationMenuLink; activeId?: string }) {
  const close = useContext(CloseDropdown);
  const props = { href: item.href, "aria-current": item.id === activeId ? "page" as const : undefined,
    className: `block rounded-lg px-3 py-2 text-sm whitespace-normal wrap-anywhere focus-visible:outline-2 focus-visible:outline-primary ${item.id === activeId ? "bg-primary/10 font-semibold text-primary" : "text-base-content/75 hover:bg-base-200 hover:text-base-content"}` };
  return <NavigationGuardLink {...props} onClick={close}>{item.label}</NavigationGuardLink>;
}

export default function ApplicationNavigation({ applications }: { applications: readonly Navigation[] }) {
  const pathname = usePathname();
  const application = activeApplication(applications, pathname);
  if (!application) return null;
  const activeId = activeApplicationMenu(application.menus, pathname)?.id;
  return <nav key={pathname} aria-label={`Navegación de ${application.name}`} className="min-w-0">
    <div className="lg:hidden">
      <NavigationDropdown label={<><Menu size={15} aria-hidden="true" /><span>Menú</span></>} accessibleLabel={`Menú de ${application.name}`}>
        <>
          <p className="px-3 py-2 text-sm font-semibold wrap-anywhere">{application.name}</p>
          <ul className="space-y-1">{application.menus.map(item => <li key={item.id}>{"items" in item
            ? <><p className="px-3 pt-3 pb-1 text-xs font-medium text-base-content/50 wrap-anywhere">{item.label}</p><ul>{item.items.map(child => <li key={child.id}><MenuLink item={child} activeId={activeId} /></li>)}</ul></>
            : <MenuLink item={item} activeId={activeId} />}</li>)}</ul>
          <div className="mt-2 border-t border-base-300 pt-2"><MenuLink item={{ id: "all-applications", label: "Todas las aplicaciones", href: "/erp" }} /></div>
        </>
      </NavigationDropdown>
    </div>
    <div className="hidden min-w-0 flex-wrap items-center gap-x-2 gap-y-1 lg:flex">
      <span className="min-w-0 px-2 py-1 text-sm font-semibold wrap-anywhere">{application.name}</span>
      <ul className="flex min-w-0 flex-wrap items-center gap-1">{application.menus.map(item => <li key={item.id} className="min-w-0">{"items" in item
        ? <NavigationDropdown label={<span className="min-w-0 wrap-anywhere">{item.label}</span>} accessibleLabel={`${application.name}: ${item.label}`} active={item.items.some(child => child.id === activeId)}>
          <ul>{item.items.map(child => <li key={child.id}><MenuLink item={child} activeId={activeId} /></li>)}</ul>
        </NavigationDropdown>
        : <MenuLink item={item} activeId={activeId} />}</li>)}</ul>
    </div>
  </nav>;
}
