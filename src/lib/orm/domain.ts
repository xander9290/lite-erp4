import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { ModelActor } from "./context";
import { INTEGER_MAX, INTEGER_MIN, type FieldMetadata } from "./fields";
import { domainBuilder, snapshotDomain, domainDependencies, resolveDomain, type DomainBuilder, type DomainExpression } from "./domain-builder";

export type DomainValue = string | number | boolean | null;
export type DomainField<T> = Extract<keyof T, string> | "id" | "createBy" | "createdAt" | "updatedAt";
export type DomainNode<T> =
  | { readonly field: DomainField<T>; readonly operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "startsWith" | "endsWith"; readonly value: DomainValue }
  | { readonly field: DomainField<T>; readonly operator: "in" | "notIn"; readonly value: readonly Exclude<DomainValue, null>[] }
  | { readonly all: readonly DomainNode<T>[] }
  | { readonly any: readonly DomainNode<T>[] }
  | { readonly not: DomainNode<T> };
/** Top-level conditions are combined with AND. Values use native scalar types. */
export type ListDomain<T = Record<string, unknown>> = readonly DomainNode<T>[];
export type ListDomainContext = { readonly actor: Readonly<ModelActor>; readonly tx: Prisma.TransactionClient };
export type ListActionOptions<T> = {
  readonly domain?: ListDomain<T> | ((context: ListDomainContext & DomainBuilder<DomainField<T>>) => DomainExpression<DomainField<T>> | ListDomain<T> | Promise<DomainExpression<DomainField<T>> | ListDomain<T>>);
};
export type CollectionDomain = (d: DomainBuilder, context: ListDomainContext) => DomainExpression;

export async function compileCollectionDomain(metadata: Readonly<Record<string, FieldMetadata>>, source: CollectionDomain, context: ListDomainContext) {
  const expression = snapshotDomain(await source(domainBuilder, context));
  if (domainDependencies(expression).length) throw new Error("Las colecciones no tienen borrador: usa constantes o contexto del servidor.");
  return compileListDomain(metadata, [expression]);
}

/** Validate both sides of references before resolving values; only public persisted scalars. */
export function validateRelationDomain(expression: DomainExpression, target: Readonly<Record<string, FieldMetadata>>, owner: Readonly<Record<string, FieldMetadata>>) {
  function walk(node: DomainExpression): void {
    if ("all" in node) return node.all.forEach(walk);
    if ("any" in node) return node.any.forEach(walk);
    if ("not" in node) return walk(node.not);
    if (node.value && !Array.isArray(node.value) && typeof node.value === "object" && "draft" in node.value) {
      const dependency = Object.hasOwn(owner, node.value.draft) ? owner[node.value.draft] : undefined;
      const destination: FieldMetadata | undefined = Object.hasOwn(target, node.field) ? target[node.field] : node.field === "id" ? { kind: "text", required: true, unique: false, trim: true, defaultKind: "empty" } : undefined;
      const scalarKind = (field: FieldMetadata | undefined) => field?.kind === "many2one" || field?.kind === "selection" ? "text" : field?.kind;
      if (!dependency || dependency.sensitive || dependency.related || dependency.compute || dependency.kind === "image" || !destination || scalarKind(dependency) !== scalarKind(destination)) throw new Error("Dependencia de dominio inválida o incompatible.");
      if (dependency.kind === "many2one" && destination.kind === "many2one" && dependency.target !== destination.target) throw new Error("Las dependencias Many2one del dominio deben referirse al mismo modelo.");
      // Validate operator and destination even when the dependency is empty.
      const example = destination.kind === "boolean" ? false : destination.kind === "integer" ? 0 : destination.kind === "datetime" ? "2026-01-01T00:00:00.000Z" : destination.kind === "selection" ? destination.choices[0].value : "domain-value";
      compileListDomain(target, [{ ...node, value: example }]);
    } else compileListDomain(target, [node]);
  }
  walk(snapshotDomain(expression));
}

export function compileRelationDomain(expression: DomainExpression, target: Readonly<Record<string, FieldMetadata>>, owner: Readonly<Record<string, FieldMetadata>>, values: Readonly<Record<string, unknown>>) {
  validateRelationDomain(expression, target, owner);
  return compileListDomain(target, [resolveDomain(expression, values)]);
}

type Predicate = Record<string, unknown>;
type Compiled = Predicate | boolean;
const equality = ["eq", "neq", "in", "notIn"];
const comparison = ["gt", "gte", "lt", "lte"];
const textSearch = ["contains", "startsWith", "endsWith"];
const iso = z.iso.datetime();
const invalid = () => new Error("Dominio de lista inválido: revisa campos, operadores y valores del servidor.");

/** No raw Prisma where, relation traversal, client metadata or JavaScript expressions. */
export function compileListDomain(metadata: Readonly<Record<string, FieldMetadata>>, domain: unknown): Predicate {
  let nodes = 0;
  function combine(kind: "all" | "any", values: Compiled[]): Compiled {
    if (values.includes(kind === "all" ? false : true)) return kind === "any";
    const predicates = values.filter((value): value is Predicate => typeof value !== "boolean");
    if (!predicates.length) return kind === "all";
    return { [kind === "all" ? "AND" : "OR"]: predicates };
  }
  function compileArray(value: unknown, kind: "all" | "any", depth: number): Compiled {
    if (!Array.isArray(value) || value.length > 100 || depth > 8) throw invalid();
    // Validate every branch, including those simplified to a constant.
    return combine(kind, value.map(node => compile(node, depth + 1)));
  }
  function compile(value: unknown, depth: number): Compiled {
    if (++nodes > 100 || depth > 8 || !value || typeof value !== "object" || Array.isArray(value)) throw invalid();
    const node = value as Record<string, unknown>;
    const keys = Object.keys(node);
    for (const logical of ["all", "any", "not"] as const) if (Object.hasOwn(node, logical)) {
      if (keys.length !== 1) throw invalid();
      if (logical !== "not") return compileArray(node[logical], logical, depth);
      const inner = compile(node.not, depth + 1);
      return typeof inner === "boolean" ? !inner : { NOT: inner };
    }
    if (keys.length !== 3 || !["field", "operator", "value"].every(key => Object.hasOwn(node, key)) || typeof node.field !== "string" || typeof node.operator !== "string") throw invalid();
    const field = Object.hasOwn(metadata, node.field) ? metadata[node.field] : undefined;
    const implicit = ["id", "createBy", "createdAt", "updatedAt"].includes(node.field);
    if (!field && !implicit) throw invalid();
    if (field && (field.sensitive || field.compute || field.related)) throw invalid();
    const kind = field?.kind ?? (["createdAt", "updatedAt"].includes(node.field) ? "datetime" : "id");
    const nullable = field ? !field.required : node.field === "createBy";
    const allowed = kind === "boolean" ? ["eq", "neq"] : [...equality, ...(["integer", "datetime"].includes(kind) ? comparison : kind === "text" ? textSearch : [])];
    if (!allowed.includes(node.operator)) throw invalid();
    function scalar(input: unknown, allowNull: boolean): unknown {
      if (input === null) { if (!allowNull || !nullable) throw invalid(); return null; }
      if (kind === "boolean") { if (typeof input !== "boolean") throw invalid(); return input; }
      if (kind === "integer") { if (typeof input !== "number" || !Number.isInteger(input) || input < INTEGER_MIN || input > INTEGER_MAX) throw invalid(); return input; }
      if (typeof input !== "string") throw invalid();
      if (kind === "datetime") { if (!iso.safeParse(input).success) throw invalid(); return new Date(input); }
      if (field?.kind === "selection" && !field.choices.some(choice => choice.value === input)) throw invalid();
      if (["id", "many2one"].includes(kind) && (!input.trim() || input.length > 100)) throw invalid();
      return input;
    }
    const list = node.operator === "in" || node.operator === "notIn";
    if (list && (!Array.isArray(node.value) || node.value.length > 100)) throw invalid();
    const operand = list ? (node.value as unknown[]).map(item => scalar(item, false)) : scalar(node.value, node.operator === "eq" || node.operator === "neq");
    // Empty memberships have explicit boolean semantics, also under NOT.
    if (list && !(operand as unknown[]).length) return node.operator === "notIn";
    const operator = node.operator === "eq" ? "equals" : node.operator === "neq" ? "not" : node.operator;
    // PostgreSQL LIKE wildcards are literal in domain string searches.
    const literal = typeof operand === "string" && textSearch.includes(operator) ? operand.replace(/[\\%_]/g, "\\$&") : operand;
    return { [node.field]: { [operator]: literal } };
  }
  const result = compileArray(domain, "all", 0);
  // Prisma can simplify an empty OR nested inside AND to an omitted condition.
  // An empty ID membership is an explicit false predicate at every nesting level.
  return typeof result === "boolean" ? result ? {} : { id: { in: [] } } : result;
}
