import { z } from "zod";
import { fieldInputSchema } from "../orm/sequence";
import { Fields } from "../orm/fields";
import type { Field } from "../orm/fields";
import { fieldFromMetadata } from "./fields";
import { recordIdentityShape, validateRecordIdentity } from "../orm/record";
import { createSignedCloudinaryImageUploader } from "../uploads/cloudinary";
import type { ModelLookupRequest } from "../many2one/model-lookup";
import type { ReactionRequest } from "../orm/reactions.types";
import { collectionFieldMetadata, type ModelClientConfig, type ModelLineConfig } from "./config";
import type { FormLineModel } from "@/components/ui/form/modelFields";
import { modelRelationLookup, modelReact, modelSignImage, modelQuickCreate } from "./actions";
import { domainDependencies, type DomainExpression } from "../orm/domain-builder";

const mapValues = <T, R>(source: Readonly<Record<string, T>>, map: (value: T, key: string) => R) =>
  Object.fromEntries(Object.entries(source).map(([key, value]) => [key, map(value, key)])) as Record<string, R>;

export type ModelUI = ReturnType<typeof buildModelUI>;
type LineUI = FormLineModel & { schema: z.ZodType; model?: string };

/** Everything a form or collection needs on the client, built once per config. */
export function buildModelUI(config: ModelClientConfig) {
  const fields = mapValues(config.fields, fieldFromMetadata);
  const many2many = mapValues(config.many2many ?? {}, metadata => Fields.Many2many(metadata.target, { ...Object.fromEntries(Object.entries(metadata).filter(([key]) => key !== "target" && key !== "domain")), ...(metadata.domain ? { domain: () => metadata.domain! } : {}) }));
  const readFields = mapValues(config.preview, fieldFromMetadata);
  const buildLine = (line: ModelLineConfig): LineUI => {
    const fields = mapValues(line.fields, fieldFromMetadata);
    const nested = mapValues(line.lines ?? {}, buildLine);
    const readable = Object.fromEntries(Object.entries(fields).filter(([name]) => !line.fieldAccess?.[name]?.noRead));
    const readableNested = Object.fromEntries(Object.entries(nested).filter(([name]) => !line.fieldAccess?.[name]?.noRead));
    const schema = z.strictObject({ ...mapValues(readable, field => fieldInputSchema(field)), ...mapValues(readableNested, child => z.array(child.schema).min(child.minRows).max(child.maxRows)) }).extend(recordIdentityShape).superRefine(validateRecordIdentity as never);
    return {
      fields, schema, fieldAccess: line.fieldAccess, ...line.metadata, capabilities: line.capabilities,
      ...(Object.keys(nested).length ? { lines: nested } : {}),
      createRow: () => ({ ...mapValues(readable, field => field.createDefault()), ...mapValues(readableNested, () => []) }),
      lookups: mapValues(line.lookups, (_target, field) => (request: ModelLookupRequest) => modelRelationLookup(line.model, field, { request, draft: {} })),
      domainLookups: domainLookups(line.model, line.fields, {}),
      uploads: Object.fromEntries(Object.entries(line.fields).filter(([, field]) => field.kind === "image").map(([name]) => [name, createSignedCloudinaryImageUploader(() => modelSignImage(line.model, name))])),
    };
  };
  const lines = mapValues(config.lines ?? {}, buildLine);
  const readable = <T,>(source: Record<string, T>) => Object.fromEntries(Object.entries(source).filter(([name]) => !config.fieldAccess?.[name]?.noRead));
  const schema = z.strictObject({ ...mapValues(readable(fields), field => fieldInputSchema(field)), ...mapValues(readable(many2many), field => field.schema), ...mapValues(readable(lines), line => z.array(line.schema).min(line.minRows).max(line.maxRows)) }).extend(recordIdentityShape).superRefine(validateRecordIdentity as never);
  const collectionFields: Record<string, Pick<Field, "metadata">> = mapValues(collectionFieldMetadata(config), metadata => ({ metadata }));
  const images = Object.entries(config.fields).filter(([, field]) => field.kind === "image" && !field.sensitive).map(([name]) => name);
  const recordUI = {
    fields, readFields, lines, many2many, fieldAccess: config.fieldAccess,
    reactions: { rules: config.reactionRules, load: (request: ReactionRequest) => modelReact(config.id, request) },
    lookups: mapValues(config.lookups, (_target, field) => (request: ModelLookupRequest) => modelRelationLookup(config.id, field, { request, draft: {} })),
    // Only fields still marked create after the access projection (actor may create the target).
    creators: Object.fromEntries(Object.entries(config.many2many ?? {}).filter(([, metadata]) => metadata.create).map(([name]) => [name, (text: string) => modelQuickCreate(config.id, name, text)])),
    domainLookups: domainLookups(config.id, config.fields, config.many2many ?? {}),
    uploads: Object.fromEntries(images.map(name => [name, createSignedCloudinaryImageUploader(() => modelSignImage(config.id, name))])),
  };
  return {
    config, fields, readFields, collectionFields, schema, recordUI,
    createDefaults: (): Record<string, unknown> => ({ ...mapValues(readable(fields), field => field.createDefault()), ...mapValues(readable(many2many), field => field.createDefault()), ...mapValues(readable(lines), () => []) }),
  };
}

function domainLookups(model: string, fields: ModelClientConfig["fields"], many: NonNullable<ModelClientConfig["many2many"]>) {
  const domains: Record<string, DomainExpression> = Object.fromEntries([
    ...Object.entries(fields).flatMap(([name, field]) => field.kind === "many2one" && field.domain ? [[name, field.domain] as const] : []),
    ...Object.entries(many).flatMap(([name, field]) => field.domain ? [[name, field.domain] as const] : []),
  ]);
  return mapValues(domains, (domain, field) => ({ dependencies: domainDependencies(domain), load: (request: ModelLookupRequest, draft: Record<string, unknown>) => modelRelationLookup(model, field, { request, draft }) }));
}
