import type { ModuleModel } from "./define";
import { relationFieldName } from "../orm/display";
import { hasPrivateFields, type ElementPolicies, type FieldRestriction, type ModelElementAccess } from "../access/element-policy";

/** Registry-backed elements, never arbitrary field/action names from a browser. */
export function restrictionFields(entry: ModuleModel): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const name of entry.clientFields) if (!entry.metadata[name]?.sensitive) fields[name] = entry.metadata[name]?.label ?? name;
  for (const [name, field] of Object.entries({ ...entry.contract.relatedFields, ...entry.contract.computedFields })) fields[name] = field.metadata.label ?? name;
  for (const [name, field] of Object.entries(entry.contract.many2manyFields)) fields[name] = field.many2many.label ?? name;
  for (const [name, field] of Object.entries(entry.contract.one2manyFields)) fields[name] = field.one2many.label ?? name;
  for (const [name, field] of Object.entries(entry.contract.childCollections)) fields[name] = field.label ?? name;
  return fields;
}

/** Dependency checks use composed models, including related routes and computed reads. */
export function projectElementAccess(entry: ModuleModel, policies: ElementPolicies, entries: readonly ModuleModel[]): ModelElementAccess {
  const byName = new Map(entries.map(model => [model.contract.name, model]));
  const canReadPath = (owner: ModuleModel, path: string, seen: readonly string[] = []): boolean => {
    const identity = `${owner.id}:${path}`;
    if (seen.includes(identity) || seen.length > 12) return false;
    const next = [...seen, identity];
    const [head, ...tail] = path.split(".");
    if (["id", "revision"].includes(head)) return tail.length === 0;
    if (head === "createBy") {
      const target = byName.get("User");
      return Boolean(target && canReadPath(target, "name", next));
    }
    if (head === "createByUser") {
      const target = byName.get("User");
      return Boolean(target && canReadPath(target, tail.join("."), next));
    }
    const key = Object.hasOwn(owner.metadata, head) ? head : Object.entries(owner.metadata).find(([key, field]) => field.kind === "many2one" && relationFieldName(key) === head)?.[0] ?? head;
    if (policies.fieldAccess[owner.id]?.[key]?.noRead) return false;
    const related = owner.contract.relatedFields?.[key]?.metadata.related;
    if (related) return !tail.length && canReadPath(owner, related, next);
    if (Object.hasOwn(owner.contract.computedFields ?? {}, key)) {
      const rules = owner.contract.computedRules?.filter(rule => rule.outputs.includes(key)) ?? [];
      return !tail.length && (rules.length ? rules.every(rule => rule.reads.every(read => canReadPath(owner, read, next))) : !hasPrivateFields(policies.fieldAccess[owner.id] ?? {}));
    }
    if (!tail.length) return true;
    const field = owner.metadata[key];
    const target = field?.kind === "many2one" ? byName.get(field.target) : undefined;
    return Boolean(target && canReadPath(target, tail.join("."), next));
  };
  const names = restrictionFields(entry);
  const fields: Record<string, FieldRestriction> = Object.fromEntries(Object.entries(policies.fieldAccess[entry.id] ?? {}).filter(([name]) => Object.hasOwn(names, name)).map(([name, policy]) => [name, { ...policy }]));
  for (const name of Object.keys({ ...entry.contract.relatedFields, ...entry.contract.computedFields })) if (!canReadPath(entry, name)) fields[name] = { noRead: true, noWrite: true, invisible: true, readOnly: true };
  for (const name of entry.list.fields) if (!canReadPath(entry, name)) fields[name] = { noRead: true, noWrite: true, invisible: true, readOnly: true };
  const privateDocument = (owner: ModuleModel, seen = new Set<string>()): boolean => {
    if (seen.has(owner.id)) return true;
    const next = new Set([...seen, owner.id]);
    if (Object.keys(restrictionFields(owner)).some(field => !canReadPath(owner, field))) return true;
    return Object.values(owner.contract.one2manyFields).some(field => {
      const child = byName.get(field.one2many.target);
      return Boolean(child && privateDocument(child, next));
    });
  };
  return { fields, privateDocument: privateDocument(entry), blockedActions: policies.blockedActions[entry.id] ?? [], canRead: paths => paths.every(path => canReadPath(entry, path)) };
}
