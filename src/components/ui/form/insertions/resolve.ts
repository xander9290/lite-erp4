/**
 * Pure resolution of view insertions (no React): which entries an anchor renders, in which
 * order, and which ones are rejected (conflicts, missing targets, missing dependencies).
 * Design and rules: docs/ideas/inserciones-vistas.md.
 */

export const insertionPositions = ["before", "after", "inside", "replace"] as const;
export type InsertionPosition = (typeof insertionPositions)[number];

export type InsertionEntry<C = unknown> = {
  /** Unique registration id (one `<Inserter>` instance). */
  readonly key: string;
  /** Registration order inside the collector, for stable ties. */
  readonly seq: number;
  /** Incremented when the content changes (cache signature). */
  readonly rev: number;
  readonly module: string;
  readonly target: string;
  readonly position: InsertionPosition;
  readonly content: C;
};

/** Extension modules of the form, already in dependency order (server composition order). */
export type InsertionModule = { readonly module: string; readonly depends: readonly string[] };

export type InsertionSlot<C = unknown> = {
  readonly before: readonly InsertionEntry<C>[];
  readonly after: readonly InsertionEntry<C>[];
  readonly inside: readonly InsertionEntry<C>[];
  readonly replace?: InsertionEntry<C>;
};

export type MountedTargets = ReadonlyMap<string, { readonly publisher?: string; readonly count: number }>;

export type InsertionResolution<C = unknown> = {
  /** Entries that could not be placed, by module: rendered in the module's fallback group. */
  readonly fallback: ReadonlyMap<string, readonly InsertionEntry<C>[]>;
  readonly issues: readonly string[];
};

const allowed: Readonly<Record<string, readonly InsertionPosition[]>> = {
  field: ["before", "after", "replace"],
  group: insertionPositions,
  stack: insertionPositions,
  media: insertionPositions,
  notebook: ["before", "after", "inside"],
  page: insertionPositions,
  // Collections (ModelCollection): list columns and zones of the default card.
  column: ["before", "after", "replace"],
  columns: ["inside"],
  card: ["before", "after", "inside"],
};
const fixedNames: Readonly<Record<string, readonly string[]>> = { columns: ["end"], card: ["title", "body", "footer"] };
const targetPattern = /^(field|group|stack|media|notebook|page|column|columns|card):([A-Za-z][\w-]*(?:\/[A-Za-z0-9][\w-]*)?)$/;

/** Syntax and position check of one declaration; undefined when valid. */
export function insertionDeclarationIssue(target: string, position: string): string | undefined {
  const match = targetPattern.exec(target);
  if (!match) return `destino inválido «${target}» (usa field:, group:, stack:, media:, notebook:, page:<notebook>/<página>, column:, columns:end o card:)`;
  const [, kind, name] = match;
  if ((kind === "page") !== name.includes("/")) return `destino inválido «${target}» (sólo page: usa <notebook>/<página>)`;
  if (fixedNames[kind] && !fixedNames[kind].includes(name)) return `destino inválido «${target}» (usa ${fixedNames[kind].map(item => `${kind}:${item}`).join(", ")})`;
  if (!(allowed[kind] as readonly string[]).includes(position)) return `${target} no admite position="${position}" (usa ${allowed[kind].join(", ")})`;
  return undefined;
}

const describe = (entry: InsertionEntry) => `${entry.module}: ${entry.target} (${entry.position})`;

function ordering(modules: readonly InsertionModule[]) {
  const rank = new Map(modules.map((item, index) => [item.module, index]));
  const depends = new Map(modules.map(item => [item.module, new Set(item.depends)]));
  return {
    sort: <C>(entries: Iterable<InsertionEntry<C>>) => [...entries].sort((a, b) =>
      (rank.get(a.module) ?? modules.length) - (rank.get(b.module) ?? modules.length) || a.module.localeCompare(b.module) || a.seq - b.seq),
    dependsOn: (module: string, other: string) => depends.get(module)?.has(other) === true,
  };
}

/** Valid, de-duplicated entries in module order, plus registration issues. */
function accepted<C>(entries: Iterable<InsertionEntry<C>>, modules: readonly InsertionModule[]) {
  const issues: string[] = [];
  const rejected: InsertionEntry<C>[] = [];
  const seen = new Set<string>();
  const valid: InsertionEntry<C>[] = [];
  for (const entry of ordering(modules).sort(entries)) {
    const declaration = insertionDeclarationIssue(entry.target, entry.position);
    if (declaration) { issues.push(`${entry.module}: ${declaration}.`); rejected.push(entry); continue; }
    const id = `${entry.module}|${entry.target}|${entry.position}`;
    if (seen.has(id)) { issues.push(`${describe(entry)} está declarado más de una vez; reúne su contenido en un solo <Inserter>.`); continue; }
    seen.add(id);
    valid.push(entry);
  }
  return { valid, issues, rejected };
}

/**
 * Entries one anchor renders. `publisher` is the module whose inserted content published the
 * anchor (undefined for the base form): only that module or modules depending on it may use it.
 */
export function slotEntries<C>(entries: Iterable<InsertionEntry<C>>, modules: readonly InsertionModule[], target: string, publisher?: string) {
  const { dependsOn } = ordering(modules);
  const issues: string[] = [];
  const rejected: InsertionEntry<C>[] = [];
  const own = accepted([...entries].filter(entry => entry.target === target), modules);
  issues.push(...own.issues);
  rejected.push(...own.rejected);
  const usable = own.valid.filter(entry => {
    if (!publisher || entry.module === publisher || dependsOn(entry.module, publisher)) return true;
    issues.push(`${describe(entry)}: el destino lo publica ${publisher}; declara depends: ["${publisher}"].`);
    rejected.push(entry);
    return false;
  });
  const replaces = usable.filter(entry => entry.position === "replace");
  let replace: InsertionEntry<C> | undefined;
  if (replaces.length) {
    // The most specific replacement wins when it depends on every other one (explicit inheritance).
    replace = replaces.find(candidate => replaces.every(other => other === candidate || dependsOn(candidate.module, other.module)));
    if (!replace) {
      issues.push(`${target} lo reemplazan ${replaces.map(entry => entry.module).join(" y ")} sin dependencia entre ellos; se usa el de ${replaces[0].module}.`);
      replace = replaces[0];
    }
  }
  const inside = usable.filter(entry => entry.position === "inside");
  if (replace && inside.length) {
    for (const entry of inside) issues.push(`${describe(entry)}: el contenedor fue reemplazado por ${replace.module}.`);
    rejected.push(...inside);
  }
  const slot: InsertionSlot<C> = {
    before: usable.filter(entry => entry.position === "before"),
    after: usable.filter(entry => entry.position === "after"),
    inside: replace ? [] : inside,
    ...(replace ? { replace } : {}),
  };
  return { slot, issues, rejected };
}

/** Whole-form check once anchors are mounted: missing targets, duplicates and conflicts. */
export function resolveInsertions<C>(entries: Iterable<InsertionEntry<C>>, modules: readonly InsertionModule[], mounted: MountedTargets): InsertionResolution<C> {
  const all = [...entries];
  const issues: string[] = [];
  const fallback = new Map<string, InsertionEntry<C>[]>();
  const fall = (entry: InsertionEntry<C>) => fallback.set(entry.module, [...(fallback.get(entry.module) ?? []), entry]);
  for (const [target, info] of mounted) if (info.count > 1) issues.push(`El destino ${target} aparece ${info.count} veces en el formulario; los destinos deben ser únicos.`);
  const targets = [...new Set(all.map(entry => entry.target))];
  for (const target of targets) {
    const info = mounted.get(target);
    if (!info) {
      const own = accepted(all.filter(entry => entry.target === target), modules);
      issues.push(...own.issues);
      for (const entry of own.valid) issues.push(`${describe(entry)}: el destino no existe en esta vista; su contenido se muestra al final.`);
      [...own.valid, ...own.rejected].forEach(fall);
      continue;
    }
    const resolved = slotEntries(all, modules, target, info.publisher);
    issues.push(...resolved.issues);
    resolved.rejected.forEach(fall);
  }
  const sorted = new Map([...fallback].map(([module, list]) => [module, ordering(modules).sort(list)] as const));
  return { fallback: sorted, issues: [...new Set(issues)] };
}
