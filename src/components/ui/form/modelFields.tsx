"use client";
import { createContext, useContext } from "react";
import type { FormReactions, ReactionState } from "./useModelReactions";
import type { PublishedFields } from "@/lib/orm/presentation";
import type { Many2OneLoader } from "@/lib/many2one/model-lookup";
import type { ImageUploader } from "./image.types";
import type { FieldDirection } from "./field.types";
import { useFieldDirection } from "./fieldDirection";

export type FormLineModel = {
  fieldAccess?: import("@/lib/access/element-policy").FieldRestrictions;
  label?: string; minRows: number; maxRows: number; invisible?: boolean;
  fields: PublishedFields;
  createRow: () => Record<string, unknown>;
  capabilities: { read: boolean; create: boolean; write: boolean; unlink: boolean };
  lookups?: Readonly<Record<string, Many2OneLoader>>;
  domainLookups?: Readonly<Record<string, RelationDomainLookup>>;
  uploads?: Readonly<Record<string, ImageUploader>>;
  /** Sub-lines of this line (nested documents). */
  lines?: Readonly<Record<string, FormLineModel>>;
};
export type RelationDomainLookup = { dependencies: readonly string[]; usesRecordId?: boolean; load: (request: import("@/lib/many2one/model-lookup").ModelLookupRequest, draft: Record<string, unknown>, record?: import("@/lib/orm/domain-builder").DomainRecord) => ReturnType<Many2OneLoader> };
export type FormModel = { fieldAccess?: import("@/lib/access/element-policy").FieldRestrictions; creators?: Readonly<Record<string, import("@/lib/many2one/types").Many2OneCreator>>; domainLookups?: Readonly<Record<string, RelationDomainLookup>>; many2many?: Readonly<Record<string, import("@/lib/orm/fields").Many2manyField>>; lines?: Readonly<Record<string, FormLineModel>>; readFields?:PublishedFields; reactions?:FormReactions; reactionState?:ReactionState; retryReaction?:()=>void; fields: PublishedFields; lookups?: Readonly<Record<string, Many2OneLoader>>; uploads?: Readonly<Record<string, ImageUploader>> };
export const FormModelContext = createContext<FormModel | undefined>(undefined);

/** Line model of a One2many path: "lineas", "lineas.0.entregas" (any depth). */
export function lineAt(model: FormModel | undefined, path: string): FormLineModel | undefined {
  const parts = path.split(".");
  if (parts.length % 2 === 0) return undefined;
  let line = model?.lines?.[parts[0]];
  for (let index = 1; index < parts.length && line; index += 2) {
    if (!/^\d+$/.test(parts[index])) return undefined;
    line = line.lines?.[parts[index + 1]];
  }
  return line;
}

/**
 * Owner of a field path inside lines: "lineas.0.cantidad" → line "lineas", key "cantidad",
 * row "lineas.0"; nested paths resolve through every level. Top-level names have no line.
 */
export function lineField(model: FormModel | undefined, name: string): { line?: FormLineModel; key: string; row?: string } {
  const parts = name.split(".");
  if (parts.length < 3 || parts.length % 2 === 0 || !/^\d+$/.test(parts[parts.length - 2])) return { key: name };
  const line = lineAt(model, parts.slice(0, -2).join("."));
  return line ? { line, key: parts[parts.length - 1], row: parts.slice(0, -1).join(".") } : { key: name };
}
/** Shared readonly contract: never register computed/related values with RHF. */
export function useModelReadField(name:string, kind:string) {
  const model = useContext(FormModelContext);
  const descriptor = model?.readFields?.[name];
  if (!descriptor || descriptor.metadata.kind !== kind || descriptor.metadata.sensitive) throw new Error(`Campo de lectura no publicado o incompatible: ${name}.`);
  return {metadata:descriptor.metadata,value:model?.reactionState?.preview[name],state:model?.reactionState,retry:model?.retryReaction};
}
/** Explicit props (including false/empty labels) override inherited presentation. */
export function useModelField<P extends { name: string; direction?: FieldDirection }>(props: P, kind: string): P {
  const model = useContext(FormModelContext);
  const direction = useFieldDirection(props.direction);
  const owner = lineField(model, props.name);
  const policy = (owner.line?.fieldAccess ?? model?.fieldAccess)?.[owner.key];
  const layoutProps = { ...props, direction, ...(policy?.noWrite || policy?.readOnly ? { readOnly: true } : {}), ...(policy?.invisible ? { invisible: true } : {}) };
  if (kind === "many2many") {
    const metadata = model?.many2many?.[props.name]?.many2many;
    return { ...(metadata ? { label: metadata.label, required: metadata.minSelected > 0, invisible: metadata.invisible, maxSelected: metadata.maxSelected, load: model?.lookups?.[props.name], ...(metadata.create && model?.creators?.[props.name] ? { onCreate: model.creators[props.name] } : {}) } : {}), ...Object.fromEntries(Object.entries(layoutProps).filter(([, value]) => value !== undefined)) } as P;
  }
  const { line, key } = lineField(model, props.name);
  const fields = line?.fields ?? model?.fields;
  if (!fields || !Object.hasOwn(fields, key)) return layoutProps;
  const metadata = fields[key].metadata;
  // Sensitive values never reach the form; a write-only secret is the exception: it is always
  // received empty and only carries a new value typed by the user (e.g. a password).
  const secret = metadata.kind === "text" && metadata.writeOnly === true;
  if ((metadata.sensitive && !secret) || metadata.kind !== kind) throw new Error(`Contrato incompatible: ${props.name} (${kind}).`);
  const defaults: Record<string, unknown> = { label: metadata.label, required: metadata.kind === "boolean" ? undefined : metadata.required };
  if (metadata.kind === "text") { defaults.maxLength = metadata.maxLength; defaults.minLength = metadata.minLength; }
  if (metadata.kind === "selection") defaults.options = metadata.choices;
  if (metadata.kind === "many2one" && !("model" in props && props.model !== undefined)) defaults.load = (line?.lookups ?? model?.lookups)?.[key];
  if (metadata.kind === "image") defaults.upload = (line?.uploads ?? model?.uploads)?.[key];
  if (metadata.kind === "integer") defaults.allowNegative = (metadata.min ?? -2147483648) < 0;
  return { ...defaults, ...Object.fromEntries(Object.entries(layoutProps).filter(([, value]) => value !== undefined)), ...(metadata.sequence ? { required: false, placeholder: (props as { placeholder?: string }).placeholder ?? "Nuevo" } : {}) } as P;
}
