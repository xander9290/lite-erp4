import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { ModelActor } from "./context";
import { INTEGER_MAX, INTEGER_MIN, type FieldMetadata } from "./fields";

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
  readonly domain?: ListDomain<T> | ((context: ListDomainContext) => ListDomain<T> | Promise<ListDomain<T>>);
};

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
