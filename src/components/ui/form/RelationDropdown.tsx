"use client";

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { relationDropdownPlacement } from "./relationDropdownPlacement";

/** Stays in the Field's subtree (including native dialogs), without growing its scroll area. */
export default function RelationDropdown({ anchorRef, activeId, children }: {
  anchorRef: RefObject<HTMLDivElement | null>;
  activeId: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current, panel = panelRef.current;
    if (!anchor || !panel) return;
    const ancestors: HTMLElement[] = [];
    for (let node = anchor.parentElement; node; node = node.parentElement) ancestors.push(node);

    const update = () => {
      if (!anchor.isConnected || !panel.isConnected) return;
      const viewport = window.visualViewport;
      const bounds = { top: viewport?.offsetTop ?? 0, bottom: Math.min(window.innerHeight, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight)) };
      for (const node of ancestors) {
        if (!/^(auto|scroll|hidden|clip)$/.test(getComputedStyle(node).overflowY)) continue;
        const rect = node.getBoundingClientRect();
        const top = rect.top + node.clientTop;
        bounds.top = Math.max(bounds.top, top);
        bounds.bottom = Math.min(bounds.bottom, top + node.clientHeight);
      }
      const rect = anchor.getBoundingClientRect();
      const border = panel.offsetHeight - panel.clientHeight;
      const result = relationDropdownPlacement(rect, bounds, panel.scrollHeight + border);
      panel.style.top = `${anchor.offsetTop + (result.placement === "bottom" ? anchor.offsetHeight + result.gap : -result.gap)}px`;
      panel.style.transform = result.placement === "top" ? "translateY(-100%)" : "none";
      panel.style.maxHeight = `${result.maxHeight}px`;
      panel.dataset.placement = result.placement;
      panel.dataset.positioned = String(result.visible && result.maxHeight > 0);
    };

    update();
    const observer = new ResizeObserver(update);
    for (const node of [...ancestors, anchor, panel]) observer.observe(node);
    if (panel.firstElementChild) observer.observe(panel.firstElementChild);
    document.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [anchorRef]);

  useLayoutEffect(() => {
    const panel = panelRef.current, option = document.getElementById(activeId);
    if (!panel || !option || !panel.contains(option)) return;
    const bounds = panel.getBoundingClientRect(), rect = option.getBoundingClientRect();
    const top = bounds.top + panel.clientTop, bottom = top + panel.clientHeight;
    if (rect.top < top) panel.scrollTop -= top - rect.top;
    else if (rect.bottom > bottom) panel.scrollTop += rect.bottom - bottom;
  }, [activeId, children]);

  return <div ref={panelRef} data-relation-dropdown
    className="invisible absolute inset-x-0 top-0 z-40 max-h-0 overflow-y-auto overscroll-contain rounded-xl border border-base-300 bg-base-100 shadow-lg data-[positioned=true]:visible [overflow-anchor:none]">
    {children}
  </div>;
}
