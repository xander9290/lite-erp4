/** Serializable domain declarations. No database, React or server-only imports. */
export type DomainScalar = string | number | boolean | null;
export type DraftReference = { readonly draft: string };
type Operand = DomainScalar | DraftReference;
export type DomainExpression<F extends string = string> =
  | { readonly field: F; readonly operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "startsWith" | "endsWith"; readonly value: Operand }
  | { readonly field: F; readonly operator: "in" | "notIn"; readonly value: readonly Exclude<DomainScalar, null>[] }
  | { readonly all: readonly DomainExpression<F>[] }
  | { readonly any: readonly DomainExpression<F>[] }
  | { readonly not: DomainExpression<F> };
export type DomainBuilder<F extends string = string> = {
  readonly [K in "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "startsWith" | "endsWith"]: (field: F, value: Operand) => DomainExpression<F>;
} & {
  in(field: F, values: readonly Exclude<DomainScalar, null>[]): DomainExpression<F>;
  notIn(field: F, values: readonly Exclude<DomainScalar, null>[]): DomainExpression<F>;
  all(...nodes: readonly DomainExpression<F>[]): DomainExpression<F>;
  any(...nodes: readonly DomainExpression<F>[]): DomainExpression<F>;
  not(node: DomainExpression<F>): DomainExpression<F>;
  draft(field: string): DraftReference;
};
export type RelationDomain = (d: DomainBuilder) => DomainExpression;
const comparisons = Object.fromEntries(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "startsWith", "endsWith", "in", "notIn"].map(operator => [operator, (field: string, value: unknown) => ({ field, operator, value })]));
export const domainBuilder: DomainBuilder = Object.freeze({ ...comparisons,
  all: (...nodes: DomainExpression[]) => ({ all: nodes }),
  any: (...nodes: DomainExpression[]) => ({ any: nodes }),
  not: (node: DomainExpression) => ({ not: node }),
  draft: (field: string) => ({ draft: field }),
}) as unknown as DomainBuilder;

/** Narrow field names when a service already knows its record type. */
export function domainBuilderFor<F extends string>(): DomainBuilder<F> { return domainBuilder as DomainBuilder<F>; }

const invalid = () => new Error("Dominio inválido: revisa estructura, campos y dependencias.");
const safeName = (name: unknown): name is string => typeof name === "string" && /^[a-z][A-Za-z0-9]*$/.test(name) && !["constructor", "prototype", "__proto__"].includes(name);

/** Bounded copy: detects cycles, unknown keys, accessors and non-JSON values before serialization. */
export function snapshotDomain(input: unknown): DomainExpression {
  let count = 0;
  function visit(value: unknown, depth: number): DomainExpression {
    if (++count > 100 || depth > 8 || !value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Object.values(Object.getOwnPropertyDescriptors(value)).some(p => p.get || p.set)) throw invalid();
    const node = value as Record<string, unknown>, keys = Object.keys(node);
    for (const key of ["all", "any", "not"] as const) if (Object.hasOwn(node, key)) {
      if (keys.length !== 1) throw invalid();
      if (key === "not") return Object.freeze({ not: visit(node.not, depth + 1) });
      if (!Array.isArray(node[key]) || node[key].length > 100) throw invalid();
      return Object.freeze({ [key]: Object.freeze(node[key].map(child => visit(child, depth + 1))) }) as DomainExpression;
    }
    if (keys.length !== 3 || !keys.every(key => ["field", "operator", "value"].includes(key)) || !safeName(node.field) || typeof node.operator !== "string" || !Object.hasOwn(comparisons, node.operator)) throw invalid();
    const scalar = (v: unknown) => v === null || typeof v === "string" && v.length <= 16000 || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v);
    let operand: unknown = node.value;
    if (["in", "notIn"].includes(node.operator)) {
      if (!Array.isArray(operand) || operand.length > 100 || operand.some(v => v === null || !scalar(v))) throw invalid();
      operand = Object.freeze([...operand]);
    } else if (!scalar(operand)) {
      if (!operand || typeof operand !== "object" || Object.keys(operand).length !== 1 || !Object.hasOwn(operand, "draft") || Object.values(Object.getOwnPropertyDescriptors(operand)).some(p => p.get || p.set) || !safeName((operand as DraftReference).draft)) throw invalid();
      operand = Object.freeze({ draft: (operand as DraftReference).draft });
    }
    return Object.freeze({ field: node.field, operator: node.operator, value: operand }) as DomainExpression;
  }
  return visit(input, 1);
}

export function declareRelationDomain(source: RelationDomain | undefined): DomainExpression | undefined {
  if (source === undefined) return undefined;
  if (typeof source !== "function") throw invalid();
  return snapshotDomain(source(domainBuilder));
}

export function domainDependencies(expression: DomainExpression): readonly string[] {
  const result = new Set<string>();
  const walk = (node: DomainExpression): void => {
    if ("all" in node) node.all.forEach(walk);
    else if ("any" in node) node.any.forEach(walk);
    else if ("not" in node) walk(node.not);
    else if (node.value && !Array.isArray(node.value) && typeof node.value === "object" && "draft" in node.value) result.add(node.value.draft);
  };
  walk(expression);
  return Object.freeze([...result]);
}

/** Missing dependencies disable the whole domain, including OR/NOT branches. */
export function resolveDomain(expression: DomainExpression, values: Readonly<Record<string, unknown>>): DomainExpression {
  if (domainDependencies(expression).some(name => !Object.hasOwn(values, name) || values[name] === null || values[name] === undefined || values[name] === "")) return { any: [] };
  const walk = (node: DomainExpression): DomainExpression => {
    if ("all" in node) return { all: node.all.map(walk) };
    if ("any" in node) return { any: node.any.map(walk) };
    if ("not" in node) return { not: walk(node.not) };
    if (node.value && !Array.isArray(node.value) && typeof node.value === "object" && "draft" in node.value) return { ...node, value: values[node.value.draft] } as DomainExpression;
    return node;
  };
  return walk(expression);
}
