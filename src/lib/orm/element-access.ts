import { isDeepStrictEqual } from "node:util";
import { AccessError } from "../auth/policy";
import { cannotWriteField, type ModelElementAccess } from "../access/element-policy";

export const unrestrictedElements: ModelElementAccess = { fields: {}, blockedActions: [], canRead: () => true };

/** Preserve protected values from the authorized snapshot, never from a client fallback. */
export function prepareFieldInput(input: Record<string, unknown>, previous: Record<string, unknown>, access: ModelElementAccess, comparison = previous) {
  const values = { ...input };
  for (const [name, policy] of Object.entries(access.fields)) {
    if (!cannotWriteField(policy)) continue;
    if (Object.hasOwn(values, name) && (policy.noRead || !isDeepStrictEqual(values[name], comparison[name]))) throw new AccessError("DENIED");
    if (Object.hasOwn(previous, name)) values[name] = previous[name];
    else delete values[name];
  }
  return values;
}

/** Rebuild projected objects without private properties, including dotted audit projections. */
export function publicFieldValues<T extends Record<string, unknown>>(values: T, access: ModelElementAccess): T {
  const project = (source: Record<string, unknown>, prefix = ""): Record<string, unknown> => Object.fromEntries(Object.entries(source).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!key.startsWith("$") && (access.fields[path]?.noRead || !access.canRead([path]))) return [];
    if (key === "$labels" && value && typeof value === "object") return [[key, Object.fromEntries(Object.entries(value).filter(([name]) => !access.fields[name]?.noRead && access.canRead([name])))]];
    if (!key.startsWith("$") && value && typeof value === "object" && !Array.isArray(value)) return [[key, project(value as Record<string, unknown>, path)]];
    return [[key, value]];
  }));
  return project(values) as T;
}
