"use client";

import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { resolveInsertions, slotEntries, type InsertionEntry, type InsertionModule, type InsertionPosition, type InsertionResolution, type InsertionSlot } from "./resolve";

/**
 * Runtime of view insertions. Extension files declare `<Inserter>`s; they render nothing in
 * place and register their children in the form's store. Anchors (Fields, FormGroup/Stack with
 * `id`, Notebook/NotebookPage) read the store and render that content in their own position of
 * the React tree, so it keeps the right contexts (RHF, notebook page, visibility, direction).
 */

type Entry = InsertionEntry<ReactNode>;
type Slot = InsertionSlot<ReactNode>;
const emptySlot: Slot = Object.freeze({ before: [], after: [], inside: [] });
const emptyFallback: readonly Entry[] = Object.freeze([]);
const emptyIssues: readonly string[] = Object.freeze([]);

export class InsertionStore {
  private readonly entries = new Map<string, Entry>();
  private readonly mounted = new Map<string, { publisher?: string; count: number }>();
  private readonly listeners = new Set<() => void>();
  private readonly slotCache = new Map<string, { signature: string; slot: Slot }>();
  private readonly slotsCache = new Map<string, Readonly<Record<string, Slot>>>();
  private readonly fallbackCache = new Map<string, { signature: string; list: readonly Entry[] }>();
  private issuesCache: { signature: string; list: readonly string[] } = { signature: "", list: emptyIssues };
  private allFallbackCache: { signature: string; list: readonly Entry[] } = { signature: "", list: emptyFallback };
  /** Issues computed by consumers (e.g. collection columns), by source. */
  private readonly reported = new Map<string, readonly string[]>();
  private resolution?: { version: number; value: InsertionResolution<ReactNode> };
  private dirty = false;
  private ready = false;
  private version = 0;
  private seq = 0;
  /** Global counter: a re-registered key never reuses a cache signature. */
  private revision = 0;

  constructor(readonly modules: readonly InsertionModule[]) {}

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private notify() { this.version++; this.dirty = false; for (const listener of [...this.listeners]) listener(); }

  /** Called while the collector renders (before the anchors in tree order): no notification. */
  stage(key: string, module: string, target: string, position: InsertionPosition, content: ReactNode) {
    const previous = this.entries.get(key);
    if (previous && previous.content === content && previous.target === target && previous.position === position && previous.module === module) return;
    this.entries.set(key, { key, module, target, position, content, seq: previous?.seq ?? this.seq++, rev: ++this.revision });
    this.dirty = true;
  }
  /** Layout effect of the collector: subscribers re-read only when something changed. */
  flush() { if (this.dirty) this.notify(); }
  unstage(key: string) { if (this.entries.delete(key)) this.notify(); }

  mount(target: string, publisher: string | undefined) {
    const current = this.mounted.get(target);
    this.mounted.set(target, { publisher: current?.publisher ?? publisher, count: (current?.count ?? 0) + 1 });
    if (this.ready) this.notify();
    return () => {
      const info = this.mounted.get(target);
      if (!info) return;
      if (info.count > 1) this.mounted.set(target, { ...info, count: info.count - 1 });
      else this.mounted.delete(target);
      if (this.ready) this.notify();
    };
  }
  /** After the first commits: from now on missing targets fall back and issues are reported. */
  markReady() { if (!this.ready) { this.ready = true; this.notify(); } }

  slot(target: string, publisher: string | undefined): Slot {
    const { slot } = slotEntries(this.entries.values(), this.modules, target, publisher);
    const parts = [...slot.before, ...(slot.replace ? [slot.replace] : []), ...slot.inside, ...slot.after];
    if (!parts.length) return emptySlot;
    const signature = parts.map(entry => `${entry.key}:${entry.rev}:${entry.position}`).join("|");
    const cacheKey = `${target}\u0000${publisher ?? ""}`;
    const cached = this.slotCache.get(cacheKey);
    if (cached?.signature === signature) return cached.slot;
    this.slotCache.set(cacheKey, { signature, slot });
    return slot;
  }
  /** Several anchors (Notebook pages): one stable object while every slot is unchanged. */
  slots(targets: readonly string[], publisher: string | undefined): Readonly<Record<string, Slot>> {
    const cacheKey = `${targets.join("|")}#${publisher ?? ""}`;
    const next = Object.fromEntries(targets.map(target => [target, this.slot(target, publisher)]));
    const cached = this.slotsCache.get(cacheKey);
    if (cached && targets.every(target => cached[target] === next[target])) return cached;
    this.slotsCache.set(cacheKey, next);
    return next;
  }
  private resolved() {
    if (this.resolution?.version !== this.version) this.resolution = { version: this.version, value: resolveInsertions(this.entries.values(), this.modules, this.mounted) };
    return this.resolution.value;
  }
  fallback(module: string): readonly Entry[] {
    if (!this.ready) return emptyFallback;
    const list = this.resolved().fallback.get(module) ?? emptyFallback;
    const signature = list.map(entry => `${entry.key}:${entry.rev}`).join("|");
    const cached = this.fallbackCache.get(module);
    if (cached?.signature === signature) return cached.list;
    this.fallbackCache.set(module, { signature, list });
    return list;
  }
  /** Every unplaced entry, in module order (collections turn them into trailing columns/rows). */
  fallbackAll(): readonly Entry[] {
    if (!this.ready) return emptyFallback;
    const fallback = this.resolved().fallback;
    const order = [...this.modules.map(item => item.module), ...[...fallback.keys()].filter(module => !this.modules.some(item => item.module === module)).sort()];
    const list = order.flatMap(module => fallback.get(module) ?? []);
    const signature = list.map(entry => `${entry.key}:${entry.rev}`).join("|");
    if (this.allFallbackCache.signature !== signature) this.allFallbackCache = { signature, list: list.length ? list : emptyFallback };
    return this.allFallbackCache.list;
  }
  report(source: string, issues: readonly string[]) {
    const previous = this.reported.get(source) ?? emptyIssues;
    if (previous.join("\n") === issues.join("\n")) return;
    if (issues.length) this.reported.set(source, issues); else this.reported.delete(source);
    this.notify();
  }
  issues(): readonly string[] {
    if (!this.ready) return emptyIssues;
    const list = [...new Set([...this.resolved().issues, ...[...this.reported.values()].flat()])];
    const signature = list.join("\n");
    if (this.issuesCache.signature !== signature) this.issuesCache = { signature, list: list.length ? list : emptyIssues };
    return this.issuesCache.list;
  }
}

const StoreContext = createContext<InsertionStore | null>(null);
/** Module that published the current content, and targets being replaced (no recursion). */
type Scope = { readonly module?: string; readonly replacing: ReadonlySet<string> };
const rootScope: Scope = { replacing: new Set() };
const ScopeContext = createContext<Scope>(rootScope);
const CollectorContext = createContext<string | null>(null);
const noopSubscribe = () => () => {};
const noSlots: Readonly<Record<string, Slot>> = Object.freeze({});

/**
 * One store per form. `collectors` are the extension insertion files (keyed by module) and
 * render before `children`, so their registrations exist when the anchors render.
 */
export function InsertionProvider({ modules, collectors, children }: { modules: readonly InsertionModule[]; collectors: Readonly<Record<string, ReactNode>>; children: ReactNode }) {
  const signature = modules.map(item => `${item.module}<${item.depends.join(",")}`).join(";");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the store is rebuilt only when the module order changes
  const store = useMemo(() => new InsertionStore(modules), [signature]);
  useEffect(() => {
    // Wait for the cascades triggered by registrations (nested anchors) before reporting.
    const timer = setTimeout(() => store.markReady(), 0);
    return () => clearTimeout(timer);
  }, [store]);
  const entries = Object.entries(collectors);
  // No insertion files: cut any outer store (an embedded collection inside a form).
  if (!entries.length) return <StoreContext.Provider value={null}>{children}</StoreContext.Provider>;
  return <StoreContext.Provider value={store}>
    {entries.map(([module, view]) => <CollectorContext.Provider key={module} value={module}>{view}</CollectorContext.Provider>)}
    <InsertionIssues />
    {children}
  </StoreContext.Provider>;
}

/**
 * Declares content for one target of the extended form. Renders nothing where it is written;
 * the anchor of `target` renders `children` before, after, inside or instead of itself.
 */
export function Inserter({ target, position, children }: { target: string; position: InsertionPosition; children: ReactNode }) {
  const store = useContext(StoreContext);
  const owner = useContext(CollectorContext);
  const key = useId();
  if (!store || !owner) throw new Error("Inserter sólo se usa en el archivo insertions de una extensión (manifest: insertions.form).");
  // Staged during render so anchors later in the tree see it in the same pass; the effect
  // re-registers after a remount (StrictMode replays effects) and notifies changed content.
  store.stage(key, owner, target, position, children);
  useLayoutEffect(() => {
    store.stage(key, owner, target, position, children);
    store.flush();
    return () => store.unstage(key);
  }, [store, key, owner, target, position, children]);
  return null;
}

function scoped(entries: readonly Entry[], scope: Scope, replaced?: string) {
  return entries.map(entry => <ScopeContext.Provider key={entry.key} value={{ module: entry.module, replacing: replaced ? new Set([...scope.replacing, replaced]) : scope.replacing }}>{entry.content}</ScopeContext.Provider>);
}

export type InsertionAnchorSlot = {
  /** Renders before/after content around `self`, or the replacement. */
  wrap: (self: ReactNode) => ReactNode;
  /** Content appended at the end of the container (already scoped). */
  inside: ReactNode;
  /** Raw entries, for containers that need typed children (Notebook). */
  slot: Slot;
  scope: Scope;
};

/**
 * Anchor hook for containers and fields. Without a target, a provider or while rendering its
 * own replacement, it is transparent.
 */
export function useInsertionAnchor(target: string | undefined): InsertionAnchorSlot {
  const store = useContext(StoreContext);
  const scope = useContext(ScopeContext);
  const active = Boolean(store && target && !scope.replacing.has(target));
  // Same reader on the server: registrations are staged during render, before the anchors.
  const read = () => active ? store!.slot(target!, scope.module) : emptySlot;
  const slot = useSyncExternalStore(active ? store!.subscribe : noopSubscribe, read, read);
  useLayoutEffect(() => active ? store!.mount(target!, scope.module) : undefined, [active, store, target, scope.module]);
  return useMemo(() => {
    if (!active || slot === emptySlot) return { wrap: self => self, inside: null, slot: emptySlot, scope };
    return {
      wrap: self => <>{scoped(slot.before, scope)}{slot.replace ? scoped([slot.replace], scope, target) : self}{scoped(slot.after, scope)}</>,
      inside: slot.inside.length ? <>{scoped(slot.inside, scope)}</> : null,
      slot, scope,
    };
  }, [active, slot, scope, target]);
}

/** Field anchor (`field:<name>`): before, after or replace around the control. */
export function InsertionAnchor({ target, children }: { target?: string; children: ReactNode }) {
  return <>{useInsertionAnchor(target).wrap(children)}</>;
}

/** Several anchors at once (Notebook pages); same rules as useInsertionAnchor. */
export function useInsertionAnchors(targets: readonly string[]): { slots: Readonly<Record<string, Slot>>; scope: Scope } {
  const store = useContext(StoreContext);
  const scope = useContext(ScopeContext);
  const active = targets.filter(target => !scope.replacing.has(target));
  const key = active.join("\u0000");
  const read = () => store ? store.slots(active, scope.module) : noSlots;
  const slots = useSyncExternalStore(store ? store.subscribe : noopSubscribe, read, read);
  useLayoutEffect(() => {
    if (!store) return;
    const unmount = key ? key.split("\u0000").map(target => store.mount(target, scope.module)) : [];
    return () => unmount.forEach(release => release());
  }, [store, key, scope.module]);
  return { slots, scope };
}

/** Render scoped entries (exported for containers with typed children). */
export function renderInsertions(entries: readonly Entry[], scope: Scope, replaced?: string) { return scoped(entries, scope, replaced); }
export { ScopeContext as InsertionScopeContext };

/** Content of a module whose target is missing or rejected: shown in its fallback group. */
export function useInsertionFallback(module: string): ReactNode {
  const store = useContext(StoreContext);
  const list = useSyncExternalStore(store ? store.subscribe : noopSubscribe, () => store ? store.fallback(module) : emptyFallback, () => emptyFallback);
  return list.length ? <>{scoped(list, rootScope)}</> : null;
}

/** Unplaced entries of every module, raw (for consumers that interpret the content). */
export function useInsertionFallbackEntries(): readonly Entry[] {
  const store = useContext(StoreContext);
  return useSyncExternalStore(store ? store.subscribe : noopSubscribe, () => store ? store.fallbackAll() : emptyFallback, () => emptyFallback);
}

/** Report issues found while interpreting insertions (shown with the others). */
export function useInsertionReport(source: string, issues: readonly string[]) {
  const store = useContext(StoreContext);
  const signature = issues.join("\n");
  useEffect(() => {
    if (!store) return;
    store.report(source, signature ? signature.split("\n") : []);
    return () => store.report(source, []);
  }, [store, source, signature]);
}

/** Clear errors: visible in development, console in production (the form keeps working). */
function InsertionIssues() {
  const store = useContext(StoreContext);
  const issues = useSyncExternalStore(store ? store.subscribe : noopSubscribe, () => store ? store.issues() : emptyIssues, () => emptyIssues);
  useEffect(() => { for (const issue of issues) console.error(`[inserciones] ${issue}`); }, [issues]);
  if (!issues.length || process.env.NODE_ENV === "production") return null;
  return <div role="alert" className="alert alert-warning col-span-full items-start text-sm">
    <div>
      <p className="font-semibold">Inserciones de vistas con problemas</p>
      <ul className="list-disc ps-5">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
    </div>
  </div>;
}
