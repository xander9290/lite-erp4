/** Public capabilities only; never contains record values or group memberships. */
export type FieldRestriction = { noRead: boolean; noWrite: boolean; invisible: boolean; readOnly: boolean };
export type FieldRestrictions = Readonly<Record<string, FieldRestriction>>;
export type ElementPolicies = {
  fieldAccess: Readonly<Record<string, FieldRestrictions>>;
  blockedActions: Readonly<Record<string, readonly string[]>>;
};
/** Ephemeral server projection of one model, inside an authorized transaction. */
export type ModelElementAccess = {
  fields: FieldRestrictions;
  blockedActions: readonly string[];
  /** Includes editable descendants whose snapshots are consumed by parent hooks/actions. */
  privateDocument?: boolean;
  canRead: (paths: readonly string[]) => boolean;
};
export const fieldRestrictionKeys = ["noRead", "noWrite", "invisible", "readOnly"] as const;
export const emptyElementPolicies: ElementPolicies = { fieldAccess: {}, blockedActions: {} };
export const hasPrivateFields = (fields: FieldRestrictions) => Object.values(fields).some(field => field.noRead);
export const cannotWriteField = (field?: FieldRestriction) => Boolean(field?.noRead || field?.noWrite);
