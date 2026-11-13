import "server-only";
import { compileListDomain, type ListDomain, type ListDomainContext } from "../orm/domain";
import type { FieldMetadata } from "../orm/fields";

export type AccessOperation = "read" | "create" | "write" | "unlink";
export const accessOperations: readonly AccessOperation[] = ["read", "create", "write", "unlink"];
export type AccessPerms = Readonly<Record<AccessOperation, boolean>>;

/** Manifest declarations (like Odoo's res.groups, ir.model.access and ir.rule). */
export type AccessSpec = {
  /** Local key → label, or `{ label, implies }`; implies takes local keys or `<module>.<group>` ids. */
  readonly groups?: Readonly<Record<string, string | { readonly label: string; readonly implies?: readonly string[] }>>;
  /** Grants per group and model; `perms` is a subset of "crud" (create, read, update=write, delete=unlink). */
  readonly access?: readonly { readonly group: string; readonly models: string | readonly string[]; readonly perms: string }[];
  /**
   * Record rules. Without `groups` they apply to everyone (combined with AND);
   * with `groups`, the rules of the user's groups are combined with OR.
   */
  readonly rules?: readonly {
    readonly id: string; readonly label: string; readonly models: string | readonly string[];
    readonly groups?: readonly string[]; readonly operations?: readonly AccessOperation[];
    readonly domain: ListDomain | ((context: ListDomainContext) => ListDomain | Promise<ListDomain>);
  }[];
};

export type AccessGroup = { readonly id: string; readonly module: string; readonly label: string; readonly implies: readonly string[] };
export type AccessGrant = { readonly group: string; readonly model: string; readonly perms: AccessPerms };
export type AccessRule = {
  readonly id: string; readonly module: string; readonly label: string; readonly models: readonly string[];
  readonly groups?: readonly string[]; readonly operations: readonly AccessOperation[];
  readonly domain: ListDomain | ((context: ListDomainContext) => ListDomain | Promise<ListDomain>);
};
export type ModuleAccess = { readonly groups: readonly AccessGroup[]; readonly grants: readonly AccessGrant[]; readonly rules: readonly AccessRule[] };

const key = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const groupId = (module: string, value: string) => value.includes(".") ? value : `${module}.${value}`;

/** Validate and normalize a module's access declarations to public ids (`<module>.<key>`). */
export function declareAccess(module: string, spec: AccessSpec, models: Readonly<Record<string, Readonly<Record<string, FieldMetadata>>>>): ModuleAccess {
  const modelId = (value: string) => {
    if (!Object.hasOwn(models, value)) throw new Error(`${module}: el acceso apunta a un modelo inexistente: ${value}.`);
    return `${module}.${value}`;
  };
  const list = (value: string | readonly string[]) => (typeof value === "string" ? [value] : [...value]);
  const groups = Object.entries(spec.groups ?? {}).map(([name, value]): AccessGroup => {
    if (!key.test(name)) throw new Error(`${module}: clave de grupo inválida: ${name}.`);
    const label = typeof value === "string" ? value : value.label;
    if (typeof label !== "string" || !label.trim()) throw new Error(`${module}.${name}: el grupo necesita una etiqueta.`);
    const implies = typeof value === "string" ? [] : (value.implies ?? []).map(item => groupId(module, item));
    return Object.freeze({ id: `${module}.${name}`, module, label, implies: Object.freeze(implies) });
  });
  const local = new Set(groups.map(group => group.id));
  const known = (id: string) => {
    if (id.startsWith(`${module}.`) && !local.has(id)) throw new Error(`${module}: grupo no declarado: ${id}.`);
    if (!/^[a-z][a-z0-9]*\.[a-z][a-z0-9-]*$/.test(id)) throw new Error(`${module}: identificador de grupo inválido: ${id}.`);
    return id;
  };
  for (const group of groups) for (const implied of group.implies) known(implied);
  const merged = new Map<string, Record<AccessOperation, boolean>>();
  for (const grant of spec.access ?? []) {
    const group = known(groupId(module, grant.group));
    if (typeof grant.perms !== "string" || !/^[crud]*$/.test(grant.perms) || new Set(grant.perms).size !== grant.perms.length) throw new Error(`${module}: perms usa letras de "crud" sin repetir.`);
    for (const model of list(grant.models).map(modelId)) {
      const current = merged.get(`${group}|${model}`) ?? { read: false, create: false, write: false, unlink: false };
      if (grant.perms.includes("c")) current.create = true;
      if (grant.perms.includes("r")) current.read = true;
      if (grant.perms.includes("u")) current.write = true;
      if (grant.perms.includes("d")) current.unlink = true;
      merged.set(`${group}|${model}`, current);
    }
  }
  const grants = [...merged].map(([pair, perms]) => {
    const [group, model] = pair.split("|");
    return Object.freeze({ group, model, perms: Object.freeze(perms) });
  });
  const ruleIds = new Set<string>();
  const rules = (spec.rules ?? []).map((rule): AccessRule => {
    if (!key.test(rule.id) || ruleIds.has(rule.id)) throw new Error(`${module}: id de regla inválido o duplicado: ${rule.id}.`);
    ruleIds.add(rule.id);
    if (typeof rule.label !== "string" || !rule.label.trim()) throw new Error(`${module}.${rule.id}: la regla necesita una etiqueta.`);
    const operations = rule.operations ?? accessOperations;
    if (!operations.length || operations.some(operation => !accessOperations.includes(operation))) throw new Error(`${module}.${rule.id}: operaciones inválidas.`);
    const targets = list(rule.models).map(modelId);
    // Static domains are validated now against every target model; callbacks after session revalidation.
    if (typeof rule.domain !== "function") for (const target of list(rule.models)) compileListDomain(models[target], rule.domain);
    return Object.freeze({ id: `${module}.${rule.id}`, module, label: rule.label, models: Object.freeze(targets), operations: Object.freeze([...operations]),
      ...(rule.groups ? { groups: Object.freeze(rule.groups.map(item => known(groupId(module, item)))) } : {}), domain: rule.domain });
  });
  return Object.freeze({ groups: Object.freeze(groups), grants: Object.freeze(grants), rules: Object.freeze(rules) });
}

/** Groups that grant `read` on a model in code (used for menu visibility only; the server decides access). */
export function readGroups(access: ModuleAccess, model: string) {
  return access.grants.filter(grant => grant.model === model && grant.perms.read).map(grant => grant.group);
}
