import { z } from "zod";
import type { Field } from "../orm/fields";
import { fieldFromMetadata } from "./fields";
import { recordIdentityShape, validateRecordIdentity } from "../orm/record";
import { createSignedCloudinaryImageUploader } from "../uploads/cloudinary";
import type { ModelLookupRequest } from "../many2one/model-lookup";
import type { ReactionRequest } from "../orm/reactions.types";
import type { ModelClientConfig } from "./config";
import { modelLookup, modelReact, modelSignImage } from "./actions";

const mapValues = <T, R>(source: Readonly<Record<string, T>>, map: (value: T, key: string) => R) =>
  Object.fromEntries(Object.entries(source).map(([key, value]) => [key, map(value, key)])) as Record<string, R>;

export type ModelUI = ReturnType<typeof buildModelUI>;

/** Everything a form or collection needs on the client, built once per config. */
export function buildModelUI(config: ModelClientConfig) {
  const fields = mapValues(config.fields, fieldFromMetadata);
  const readFields = mapValues(config.preview, fieldFromMetadata);
  const schema = z.strictObject(mapValues(fields, field => field.schema)).extend(recordIdentityShape).superRefine(validateRecordIdentity as never);
  const collectionFields: Record<string, Pick<Field, "metadata">> = { ...fields,
    ...Object.fromEntries(config.related.filter(name => Object.hasOwn(readFields, name)).map(name => [name, { metadata: { ...readFields[name].metadata, readOnly: true } }])) };
  const images = Object.entries(config.fields).filter(([, field]) => field.kind === "image" && !field.sensitive).map(([name]) => name);
  const recordUI = {
    fields, readFields,
    reactions: { rules: config.reactionRules, load: (request: ReactionRequest) => modelReact(config.id, request) },
    lookups: mapValues(config.lookups, target => (request: ModelLookupRequest) => modelLookup(target, request)),
    uploads: Object.fromEntries(images.map(name => [name, createSignedCloudinaryImageUploader(() => modelSignImage(config.id, name))])),
  };
  return {
    config, fields, readFields, collectionFields, schema, recordUI,
    createDefaults: (): Record<string, unknown> => mapValues(fields, field => field.createDefault()),
  };
}
