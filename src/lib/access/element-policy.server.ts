import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { fieldRestrictionKeys, type FieldRestriction, type ElementPolicies } from "./element-policy";

/** Restrictions accumulate through group implication; false/omitted never adds a grant. */
export async function loadElementPolicies(tx: Prisma.TransactionClient, groups: ReadonlySet<string>): Promise<ElementPolicies> {
  if (!groups.size) return { fieldAccess: {}, blockedActions: {} };
  const where = { groupId: { in: [...groups] } };
  const [fields, actions] = await Promise.all([
    tx.accessFieldRestriction.findMany({ where }), tx.accessActionRestriction.findMany({ where }),
  ]);
  const fieldAccess: Record<string, Record<string, FieldRestriction>> = {};
  for (const row of fields) {
    // Policies cannot configure models owned by another module.
    if (row.groupId.split(".")[0] !== row.model.split(".")[0]) continue;
    const model = fieldAccess[row.model] ??= {};
    const policy = model[row.field] ??= { noRead: false, noWrite: false, invisible: false, readOnly: false };
    for (const key of fieldRestrictionKeys) policy[key] ||= row[key];
    if (policy.noRead) policy.noWrite = true;
  }
  const blockedActions: Record<string, string[]> = {};
  for (const row of actions) if (row.groupId.split(".")[0] === row.model.split(".")[0]) {
    const model = blockedActions[row.model] ??= [];
    if (!model.includes(row.action)) model.push(row.action);
  }
  return { fieldAccess, blockedActions };
}
