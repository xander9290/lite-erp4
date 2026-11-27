import "server-only";
import { modelSnapshot } from "./snapshot";
import { loadLines, validateLines, persistLines, captureOwners, countDocumentRows, MAX_DOCUMENT_ROWS, type LineRelations, type OwnerRelation, type TransactionModel, type Document, type MutationOptions } from "./one2many";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { FieldPath } from "react-hook-form";
import type { FormViewLoadResult } from "@/components/ui/form/FormViewLoader";
import type { FormViewResult } from "@/components/ui/form/formView.types";
import { AccessError } from "../auth/policy";
import { listStateSchema } from "../list/query";
import { normalizeListState } from "../list/state";
import { compileColumnFilter, filterValueError, many2manyFilterIds, many2manyFilterOperators } from "../list/filters";
import type { ListColumn, ListDataType, ListFilter, ListRecord, ListResult, ListViewConfig } from "../list/types";
import { validImageColumnOptions } from "../list/types";
import { validBadgeColumnOptions } from "../list/badge";
import { recordIdentitySchema, type RecordIdentity } from "./record";
import { ModelValidationError, type ModelActor, type ModelContext } from "./context";
import type { ModelRepository } from "./repository";
import { INTEGER_MIN, INTEGER_MAX, type FieldMetadata, type Field } from "./fields";
import { resolveCollectionComputed, validateCollectionComputed, type CollectionComputed } from "./collection-computed";
import { resolveCollectionRelated } from "./collection-related";
import { cachedRelationAccess, type RelationAccess } from "./relation-access";
import type { KanbanMoveResult, KanbanRequest, KanbanConfig } from "../kanban/types";
import { compileKanbanConfig } from "../kanban/config";
import { auditAvatarField, auditColumnType } from "./audit";
import { compileListDomain, compileCollectionDomain, type CollectionDomain, type ListActionOptions, type ListDomainContext } from "./domain";
import { domainBuilderFor } from "./domain-builder";
import { deleteListSelection } from "../list/delete";
import type { ListDeleteResult } from "../list/selection";
import { groupingPlan, groupedPage } from "../list/grouping";
import { activityRequestSchema, activityNoteSchema, type ActivityResult, type ActivityNoteResult } from "./activity";
import { recordActivity, readActivity } from "./activity.server";
import { modelLookupSchema } from "../many2one/model-lookup";
import type { Many2OneResult } from "../many2one/types";
import { resolveListLabels } from "../list/relation-labels";
import type { Many2OneLoader } from "../many2one/model-lookup";
import { fieldColumn } from "./presentation";
import type { ReactionContext } from "./reactions";
import type { ReactionRule, ReactionResult } from "./reactions.types";
import type { ActionContext, ModelAction } from "./model";
import { nestedWrite, readOnlyEnvironment, unavailableEnvironment, withFrame, type EnvironmentDomain, type ModelEnvironment, type ModelEnvironmentModel } from "./environment";
import { domainBuilder, domainDependencies, domainUsesRecordId, snapshotDomain, type DomainExpression } from "./domain-builder";
import { displayProjectionPaths } from "./display";
import { modelDisplayName, resolveDisplayNames } from "./display.server";

import { parseActionParameters } from "./action-parameters";
import { ActionParameterError } from "./context";
import { assignSequences, assertSequences } from "./sequence.server";
import { validateMany2many } from "./many2many";
import { prepareFieldInput, publicFieldValues, unrestrictedElements } from "./element-access";
import { hasPrivateFields, type ModelElementAccess } from "../access/element-policy";

const conflict = "El registro cambió desde que lo abriste. Recarga sus datos antes de guardar.";
type Contract<T extends Record<string, unknown>> = CollectionComputed & {
  readonly uniqueTogether?: readonly (readonly string[])[];
  readonly computedFields?:Readonly<Record<string,Field>>;
  readonly many2manyFields?: Readonly<Record<string, import("./fields").Many2manyField>>;
  readonly one2manyFields?: Readonly<Record<string, import("./fields").One2manyField>>;
  formSchema?: z.ZodType<T>;
  prepareSave?(values: T, context: ModelContext<T>): Promise<T>;
  constrain?(values: Readonly<Record<string, unknown>>, context: ModelContext<T>): Promise<void>;
  beforeRemove?(record: Readonly<Record<string, unknown>>, context: import("./context").RemoveContext): Promise<void>;
  readonly relatedFields?:Readonly<Record<string,Field>>;
  reactionRules?:readonly ReactionRule[];
  react?(field:string,values:Readonly<Record<string,unknown>>,context:ReactionContext):Promise<{patch:Record<string,unknown>;preview:Record<string,string|number|boolean|null>}>;
  name: string; schema: z.ZodType<T>; metadata: Readonly<Record<string, FieldMetadata>>;
  normalize?(values: Record<string, unknown>): T;
  beforeSave?(values: T, context: ModelContext<T>): Promise<T>;
  afterSave?(record: Record<string, unknown>, context: ModelContext<T>): Promise<void>;
  readonly actions?: readonly ModelAction[];
  runAction?(name: string, record: Readonly<Record<string, unknown>>, context: ActionContext, params?: unknown): Promise<Record<string, unknown>>;
  parseActionParams?(name: string, input: unknown): Record<string, unknown>;
  readonly displayFields?: readonly string[];
  createDefaults?(): Record<string, unknown>;
  displayName?(record: Readonly<Record<string, unknown>>): string;
};
const idSchema = z.string().trim().min(1).max(100);
const actionRequestSchema = z.strictObject({ action: z.string().regex(/^[a-z][A-Za-z0-9]*$/).max(60), id: idSchema, revision: z.iso.datetime({ precision: 3 }), params: z.unknown().optional() });
const codeOf = (error: unknown) => error && typeof error === "object" && "code" in error ? String(error.code) : "";
export const fieldListType = (field: FieldMetadata): ListDataType => field.kind === "integer" ? "integer" : field.kind === "boolean" ? "boolean" : field.kind === "datetime" ? "datetime" : "text";

function projectListRow(row: import("../list/types").ListRecord, paths: readonly string[]) {
  const result: import("../list/types").ListRecord = { id: row.id };
  if (row.revision !== undefined) result.revision = row.revision;
  for (const path of paths) {
    const parts = path.split(".");
    let source: import("../list/types").ListValue = row;
    let target: Record<string, import("../list/types").ListValue> = result;
    for (let index = 0; index < parts.length; index++) {
      const key = parts[index];
      if (!source || typeof source !== "object" || Array.isArray(source) || !Object.hasOwn(source, key)) break;
      source = source[key];
      if (index === parts.length - 1 || source === null) { target[key] = source; break; }
      if (!Object.hasOwn(target, key)) target[key] = {};
      target = target[key] as Record<string, import("../list/types").ListValue>;
    }
  }
  return result;
}

async function assertActor(tx: Prisma.TransactionClient, actor: ModelActor) {
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { active: true, isAdmin: true, sessionVersion: true } });
  if (!user?.active || user.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
  if (!user.isAdmin) throw new AccessError("FORBIDDEN");
}

function messageFor(error: unknown) {
  if (error instanceof AccessError || error instanceof ModelValidationError) return error.message;
  if (["P2025", "P2034"].includes(codeOf(error))) return conflict;
  if (codeOf(error) === "P2002") return "Ya existe un registro con alguno de los valores que deben ser únicos.";
  if (["P2003", "P2018"].includes(codeOf(error))) return "Uno de los registros relacionados ya no está disponible.";
  if (error instanceof Error && error.message === "MODEL_NOT_BOUND") return "La aplicación todavía no tiene su acceso a datos generado. Completa orm:bind.";
  return "No se pudo completar la operación. Recarga los datos e intenta nuevamente.";
}

export type ModelListPolicy = {
  fields: readonly string[];
  searchFields: readonly string[];
  sortable?: readonly string[];
  groupable?: readonly string[];
  filterable?: readonly string[];
};
export type ServiceOperation = "read" | "create" | "write" | "unlink";
/**
 * Authorizes an operation inside the service transaction and returns a record predicate
 * (record rules) that every query and record check must satisfy, or undefined for none.
 * Without it the service keeps the admin-only baseline.
 */
export type ServiceAuthorizer = (tx: Prisma.TransactionClient, actor: ModelActor, operation: ServiceOperation) => Promise<Record<string, unknown> | undefined>;
type ServicePresentation = {
  elementAccess?: (tx: Prisma.TransactionClient, actor: ModelActor) => Promise<ModelElementAccess>;
  domain?: CollectionDomain;
  validateRelations?: (tx: Prisma.TransactionClient, actor: ModelActor, values: Readonly<Record<string, unknown>>, record: Readonly<{ id?: string }>) => Promise<void>;
  /** Fields whose storage row may be absent (declarative extensions only). */
  collectionNullable?: readonly string[];
  lines?: LineRelations;
  owners?: readonly OwnerRelation[];
  defaultSort?: ListViewConfig["defaultSort"]; kanban?: KanbanConfig; audit?: boolean;
  relations?: Readonly<Record<string, Many2OneLoader>>;
  /** Resolve historical Many2one IDs with current target read access, in the same transaction. */
  activityLabels?: (tx: Prisma.TransactionClient, actor: ModelActor, target: string, ids: readonly string[]) => Promise<ReadonlyMap<string, string>>;
  authorize?: ServiceAuthorizer;
  /**
   * Read access to related records projected by displayName/related paths (record rules of the
   * target models). Unreadable ones are presented empty. Without it, projections are unmasked.
   */
  relationAccess?: (tx: Prisma.TransactionClient, actor: ModelActor) => RelationAccess;
  /** Revalidated for every published action (groups and element policies in the registry). */
  authorizeAction?: (tx: Prisma.TransactionClient, actor: ModelActor, action: ModelAction) => Promise<void>;
  /** `context.env` of model methods (the registry injects it); without it, using env fails explicitly. */
  environment?: (tx: Prisma.TransactionClient, actor: ModelActor) => ModelEnvironment;
} & ({ list: ModelListPolicy; columns?: never; searchFields?: never } | { list?: never; columns: readonly ListColumn[]; searchFields: readonly string[] });

/** Admin-only baseline. The repository and list policy are fixed on the server, never selected by a client. */
export function createModelService<T extends Record<string, unknown>>(model: Contract<T>, repository: ModelRepository<T>, presentation: ServicePresentation) {
  type Values = T & RecordIdentity;
  const lines = presentation.lines ?? {};
  const many = model.many2manyFields ?? {};
  const hasRelationDomains = Object.values(model.metadata).some(field => field.kind === "many2one" && field.domain) || Object.values(many).some(field => field.many2many.domain);
  if (hasRelationDomains && !presentation.validateRelations) throw new Error("Los dominios de relaciones requieren el registro declarativo y su validador autorizado.");
  const sequenceFields = Object.fromEntries(Object.entries(model.metadata).filter(([, field]) => field.sequence));
  const hasSequences = Object.keys(sequenceFields).length > 0;
  const formSchema = model.formSchema ?? model.schema;
  if (Object.keys(many).length && !presentation.relationAccess) throw new Error("Many2many requiere autorización de los destinos en módulos declarativos.");
  if (Object.keys(model.one2manyFields ?? {}).some(name => !Object.hasOwn(lines, name))) throw new Error("One2many requiere el servicio de líneas de módulos declarativos.");
  const auditFields = new Set(presentation.audit ? ["createdAt", "updatedAt", "createBy", "createByUser.login", "createByUser.name"] : []);
  const policy = presentation.list;
  const relatedFields=model.relatedFields??{};
  const nullableCollection = new Set(presentation.collectionNullable ?? []);
  const domainMetadata = Object.fromEntries(Object.entries(model.metadata).map(([name, field]) => [name, nullableCollection.has(name) ? { ...field, required: false } : field]));
  const computedFields=model.computedFields??{};
  const virtualFields={...relatedFields,...computedFields};
  const collectionMetadata:Readonly<Record<string,FieldMetadata>>={...model.metadata,...Object.fromEntries(Object.entries(virtualFields).map(([name,field])=>[name,{...field.metadata,readOnly:true}]))};
  if (policy && (presentation.columns || presentation.searchFields)) throw new Error("Usa list o columns, no ambas políticas.");
  if (policy) {
    for (const names of [policy.searchFields, policy.sortable ?? [], policy.groupable ?? [], policy.filterable ?? []]) {
      if (new Set(names).size !== names.length || names.some(name => !policy.fields.includes(name) || Object.hasOwn(virtualFields,name))) throw new Error("La política sólo puede consultar campos persistentes publicados en list.fields; related/compute son de lectura.");
    }
    if (policy.fields.some(name => (!Object.hasOwn(collectionMetadata, name) && !auditFields.has(name)) || collectionMetadata[name]?.sensitive)) throw new Error("list.fields sólo permite campos declarados no sensibles.");
  }
  const config: ListViewConfig = { model: model.name, defaultSort: presentation.defaultSort,
    columns: policy ? policy.fields.map(name => ({ ...(collectionMetadata[name] ? fieldColumn(name, collectionMetadata[name]) : { field: name, label: name, ...(auditAvatarField(name) ? { widget: "partner" as const, avatarField: auditAvatarField(name)! } : {}) }), sortable: policy.sortable?.includes(name) ?? false, groupable: policy.groupable?.includes(name) ?? false, filterable: policy.filterable?.includes(name) ?? false })) : presentation.columns!,
    searchFields: policy?.searchFields ?? presentation.searchFields!,
  };
  for (const [name, loader] of Object.entries(presentation.relations ?? {})) {
    // createBy (audit) is the creator Many2one to User, labelled by a fixed server provider.
    const creator = name === "createBy" && presentation.audit === true;
    // Many2many (tags) names are resolved per page for their IDs; they are not list columns of the policy.
    if (Object.hasOwn(model.many2manyFields ?? {}, name)) { if (typeof loader !== "function") throw new Error("Las etiquetas requieren un lookup autorizado."); continue; }
    if ((!creator && (model.metadata[name]?.kind !== "many2one" || model.metadata[name].sensitive)) || typeof loader !== "function" || !config.columns.some(column => column.field === name)) throw new Error("Las etiquetas requieren una relación publicada y un lookup autorizado.");
  }
  const allowed = new Set(["id", ...Object.keys(collectionMetadata)]);
  if (presentation.audit) for (const field of ["createdAt", "updatedAt", "createBy", "createByUser.login", "createByUser.name"]) allowed.add(field);
  const columnType = (field: string) => collectionMetadata[field] ? fieldListType(collectionMetadata[field]) : presentation.audit ? auditColumnType(field) ?? "text" : "text";
  const computedNames = config.columns.map(column => column.field).filter(name => Object.hasOwn(computedFields, name));
  validateCollectionComputed(model, computedNames, config.columns.map(column => column.field));
  config.columns = config.columns.map(column => {
    const field = collectionMetadata[column.field];
    return (column.widget === "badge" || column.colors !== undefined) && field?.kind === "selection" ? { ...column, options: field.choices } : column;
  });
  if (!config.columns.length || config.columns.length > 12 || new Set(config.columns.map(column => column.field)).size !== config.columns.length || config.columns.some(column => {
    const avatar = presentation.audit && auditAvatarField(column.field);
    const image = column.widget === "image" && collectionMetadata[column.field]?.kind === "image" && !collectionMetadata[column.field].sensitive && (!column.format || column.format === "text");
    const relation = column.widget === "many2one" && model.metadata[column.field]?.kind === "many2one" && !model.metadata[column.field].sensitive && (!column.format || column.format === "text");
    const badge = column.widget === "badge" && collectionMetadata[column.field]?.kind === "selection" && !collectionMetadata[column.field].sensitive;
    const colored = column.colors === undefined || (collectionMetadata[column.field]?.kind === "selection" && !collectionMetadata[column.field].sensitive);
    return !allowed.has(column.field) || !colored || (Object.hasOwn(virtualFields,column.field) && (column.sortable || column.filterable || column.groupable)) || !validImageColumnOptions(column) || !validBadgeColumnOptions(column) || (column.widget && !(image || relation || badge || (column.widget === "partner" && avatar && (!column.avatarField || column.avatarField === avatar) && (!column.format || column.format === "text")))) || (column.avatarField !== undefined && (column.widget !== "partner" || column.avatarField !== avatar)) || (column.type && column.type !== columnType(column.field));
  }) || config.searchFields.length > 6 || config.searchFields.some(name => name !== "id" && model.metadata[name]?.kind !== "text" && model.metadata[name]?.kind !== "many2one" && !(presentation.audit && ["createByUser.login", "createByUser.name"].includes(name)))) throw new Error("La lista sólo puede publicar campos declarados o auditoría habilitada y búsquedas de texto permitidas.");
  // Normalize date types for server filters even when the view omitted an explicit type.
  config.columns = config.columns.map(column => ({ ...column, type: columnType(column.field), ...(Object.hasOwn(virtualFields,column.field)?{filterable:false,sortable:false,groupable:false}:{}), ...(column.widget === "partner" && auditAvatarField(column.field) ? { avatarField: auditAvatarField(column.field)! } : {}) }));
  const authorize: ServiceAuthorizer = presentation.authorize ?? (async (tx, actor) => { await assertActor(tx, actor); return undefined; });
  const elements = (tx: Prisma.TransactionClient, actor: ModelActor) => presentation.elementAccess?.(tx, actor) ?? Promise.resolve(unrestrictedElements);
  const envFor = (tx: Prisma.TransactionClient, actor: ModelActor) => presentation.environment?.(tx, actor) ?? unavailableEnvironment;
  const readEnvFor = (tx: Prisma.TransactionClient, actor: ModelActor) => readOnlyEnvironment(envFor(tx, actor));
  async function publicDocument(tx: Prisma.TransactionClient, actor: ModelActor, record: Values & Document): Promise<Values & Document> {
    const access = await elements(tx, actor);
    const values = publicFieldValues(record, access);
    for (const [name, relation] of Object.entries(lines)) if (Array.isArray(values[name]) && relation.child().present) {
      (values as Record<string, unknown>)[name] = await Promise.all((values[name] as Document[]).map(row => relation.child().present!(tx, actor, row)));
    }
    return values;
  }
  async function prepareDocumentInput(tx: Prisma.TransactionClient, actor: ModelActor, input: Record<string, unknown>, previous: Document | null, inverse?: string): Promise<Record<string, unknown>> {
    if (inverse && Object.hasOwn(input, inverse)) throw new ModelValidationError("No envíes la relación inversa de una línea.");
    const access = await elements(tx, actor);
    const policy = inverse ? { ...access, fields: Object.fromEntries(Object.entries(access.fields).filter(([name]) => name !== inverse)) } : access;
    const baseline = previous ?? model.createDefaults?.() ?? {};
    const comparison = previous ? await publicDocument(tx, actor, previous as Values & Document) : baseline;
    const values = prepareFieldInput(input, baseline, policy, comparison);
    if (inverse) delete values[inverse];
    for (const [name, relation] of Object.entries(lines)) {
      const rows = values[name];
      if (policy.fields[name]?.noRead || policy.fields[name]?.noWrite) continue;
      if (!Array.isArray(rows) || !relation.child().prepareInput) continue;
      const owned = (previous?.[name] ?? []) as Document[];
      values[name] = await Promise.all(rows.map(row => {
        if (!row || typeof row !== "object" || Array.isArray(row)) throw new ModelValidationError("La línea no es válida.");
        const current = owned.find(previous => previous.id === row.id) ?? null;
        return relation.child().prepareInput!(tx, actor, row, current, relation.metadata.inverse);
      }));
    }
    return values;
  }
  /** Record rules: the record must exist and satisfy the predicate returned by authorize. */
  async function inScope(tx: Prisma.TransactionClient, id: string, scope: Record<string, unknown> | undefined) {
    return !scope || await repository.count(tx, { AND: [{ id }, scope] }) > 0;
  }
  async function readAudit(tx: Prisma.TransactionClient, id: string, actor: ModelActor) {
    if (!presentation.audit) return {};
    if (!repository.audit) throw new Error("MODEL_NOT_BOUND");
    const audit = await repository.audit(tx, id);
    if (!audit) throw new ModelValidationError("El registro ya no está disponible.");
    const access = await elements(tx, actor);
    return { audit: access.canRead(["createByUser.login", "createByUser.name", "createByUser.avatarUrl"]) ? audit : { ...audit, createBy: null } };
  }
  /** One cached access decision per target/ID within the operation. */
  const relationAccessFor = (tx: Prisma.TransactionClient, actor: ModelActor) => presentation.relationAccess ? cachedRelationAccess(presentation.relationAccess(tx, actor)) : undefined;
  async function loadDocument(tx: Prisma.TransactionClient, actor: ModelActor, record: Document) {
    const values = await loadLines(tx, actor, record, lines);
    await validateMany2many(values, many, relationAccessFor(tx, actor));
    return values;
  }
  async function readDisplayName(tx: Prisma.TransactionClient, actor: ModelActor, values: Values) {
    if (!(await elements(tx, actor)).canRead(displayProjectionPaths(model.metadata, model.displayFields))) return { displayName: values.id! };
    const names = await resolveDisplayNames(tx, [values], model, repository, relationAccessFor(tx, actor));
    return { displayName: names.get(values.id!)! };
  }
  if (config.defaultSort && !config.columns.some(column => column.field === config.defaultSort?.field && column.sortable)) throw new Error("El orden predeterminado debe apuntar a una columna ordenable de la lista.");
  const kanbanConfig = compileKanbanConfig(presentation.kanban, model.metadata, model.actions ?? [], config.columns.map(column=>column.field));
  const groupField = kanbanConfig?.field;
  const groupMetadata = groupField && Object.hasOwn(model.metadata, groupField) ? model.metadata[groupField] : null;
  const groups = groupMetadata?.kind === "selection" ? groupMetadata.choices : [];

  async function read(prisma: PrismaClient, actor: ModelActor, input: unknown): Promise<FormViewLoadResult<Values>> {
    try {
      const record = await prisma.$transaction(async tx => {
        const scope = await authorize(tx, actor, "read");
        const id = idSchema.safeParse(input);
        if (!id.success) throw new ModelValidationError("El registro no es válido.");
        // Records outside the rules behave as not found, without revealing that they exist.
        if (!await inScope(tx, id.data, scope)) return null;
        const scalar = await repository.read(tx, id.data);
        const values = scalar ? await loadDocument(tx, actor, scalar) as Values : null;
        return values ? { values: await publicDocument(tx, actor, values as Values & Document), ...await readAudit(tx, id.data, actor), ...await readDisplayName(tx, actor, values) } : null;
      }, { isolationLevel: "RepeatableRead" });
      return record ? { ok: true, ...record } : { ok: false, error: "No se encontró este registro." };
    } catch (error) { return { ok: false, kind: error instanceof ModelValidationError ? "validation" : "server", error: messageFor(error) }; }
  }

  async function persist(tx: Prisma.TransactionClient, actor: ModelActor, input: unknown, activityLabel?: string, options?: MutationOptions): Promise<Values & Document> {
    const policy = await elements(tx, actor);
    const submittedId = input && typeof input === "object" && !Array.isArray(input) && typeof (input as Record<string, unknown>).id === "string" ? (input as Record<string, string>).id : undefined;
    // The frame marks this record as in progress for nested env writes (created ones get their ID below).
    const frame: { model: string; id?: string } = { model: model.name, id: submittedId };
    try { return await withFrame(tx, frame, () => persistCore(tx, actor, input, activityLabel, options, frame)); }
    catch (error) {
      if ((policy.privateDocument || hasPrivateFields(policy.fields)) && (error instanceof ModelValidationError || error instanceof z.ZodError)) throw new ModelValidationError("No se pudo validar el registro con tus permisos actuales.");
      throw error;
    }
  }

  async function persistCore(tx: Prisma.TransactionClient, actor: ModelActor, input: unknown, activityLabel?: string, options?: MutationOptions, frame?: { id?: string }) {
    const updating = Boolean(input && typeof input === "object" && !Array.isArray(input) && (input as Record<string, unknown>).id);
    const scope = await authorize(tx, actor, updating ? "write" : "create");
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ModelValidationError("Revisa los datos del registro.");
    const { id, revision, ...submitted } = input as Record<string, unknown>;
    let fields = submitted;
    const identity = recordIdentitySchema.safeParse({ id, revision });
    // Reject forged/unknown fields before any model code can discard them.
    if (Object.keys(fields).some(key => !Object.hasOwn(model.metadata, key) && !Object.hasOwn(lines, key) && !Object.hasOwn(many, key))) throw new ModelValidationError("El registro contiene campos no declarados.");
    if (!identity.success) {
      const errors: Record<string, string> = {};
      for (const issue of identity.error.issues) if (issue.path.length) errors[issue.path.join(".")] ??= issue.message;
      throw new ModelValidationError("Revisa los datos del registro.", errors);
    }
    const metadata = identity.data;
    const scalarCurrent = metadata.id && await inScope(tx, metadata.id, scope) ? await repository.read(tx, metadata.id) : null;
    const current = scalarCurrent ? await loadDocument(tx, actor, scalarCurrent) as Values : null;
    if (metadata.id) {
      if (!current || current.revision !== metadata.revision) throw new ModelValidationError(conflict);
    }
    if (!options?.system) fields = await prepareDocumentInput(tx, actor, fields, current as Document | null);
    const context: ModelContext<T> = Object.freeze({ tx, actor: Object.freeze({ ...actor }), operation: metadata.id ? "update" : "create", id: metadata.id, previous: current ? modelSnapshot(options?.previous ?? current) as ModelContext<T>["previous"] : null, env: envFor(tx, actor) });
    if (JSON.stringify(fields).length > 256000) throw new ModelValidationError("El documento supera el tamaño permitido.");
    if (!options?.skipOwner && countDocumentRows(fields, lines) > MAX_DOCUMENT_ROWS) throw new ModelValidationError(`El documento supera el máximo de ${MAX_DOCUMENT_ROWS} líneas en total.`);
    validateLines(fields, current as Document | null, lines);
    await validateMany2many(fields, many, relationAccessFor(tx, actor));
    const sequence = hasSequences ? await assignSequences(tx, model.name, sequenceFields, fields, current) : { values: fields, locked: {} };
    const normalized = formSchema.parse(model.normalize ? model.normalize(sequence.values) : sequence.values);
    assertSequences(normalized, sequence.locked);
    const owners = await captureOwners(tx, actor, scalarCurrent, normalized, presentation.owners ?? [], options);
    const values = formSchema.parse(model.prepareSave ? await model.prepareSave(normalized, context) : model.beforeSave ? await model.beforeSave(normalized, context) : normalized);
    assertSequences(values, sequence.locked);
    validateLines(values, current as Document | null, lines);
    await validateMany2many(values, many, relationAccessFor(tx, actor));
    await presentation.validateRelations?.(tx, actor, values, { id: metadata.id });
    for (const owner of presentation.owners ?? []) if (values[owner.inverse] !== normalized[owner.inverse]) throw new ModelValidationError("La lógica del hijo no puede cambiar su documento padre.");
    // Constraints validate; their env only queries.
    const constraintContext: ModelContext<T> = Object.freeze({ ...context, env: readEnvFor(tx, actor) as unknown as ModelContext<T>["env"] });
    if (!Object.keys(lines).length) await model.constrain?.(values, constraintContext);
    const scalars = Object.fromEntries([...Object.keys(model.metadata), ...Object.keys(many)].map(name => [name, values[name]])) as T;
    const saved = metadata.id ? await repository.update(tx, metadata.id, metadata.revision!, scalars) : await repository.create(tx, scalars, actor.id);
    if (frame) frame.id = saved.id;
    const aggregate = await persistLines(tx, actor, saved, values, current as Document | null, lines, model.name);
    const canonical = formSchema.parse(aggregate.values && Object.fromEntries(Object.entries(aggregate.values).filter(([key]) => key !== "id" && key !== "revision")));
    if (Object.keys(lines).length) await model.constrain?.(canonical, constraintContext);
    await model.afterSave?.(aggregate.values, context);
    const finalScalar = await repository.read(tx, saved.id);
    if (!finalScalar) throw new ModelValidationError("El registro no está disponible después de guardar.");
    const final = await loadDocument(tx, actor, finalScalar) as Values & Document;
    assertSequences(final, sequence.locked);
    await presentation.validateRelations?.(tx, actor, final, { id: final.id });
    if (!await inScope(tx, final.id, scope)) throw new AccessError("DENIED");
    const relationsChanged = current && Object.keys(many).some(name => JSON.stringify([...(current[name] as string[])].sort()) !== JSON.stringify([...(final[name] as string[])].sort()));
    await recordActivity(tx, model.name, actor.id, model.metadata, current, final, activityLabel ?? (aggregate.changed ? "Líneas actualizadas" : relationsChanged ? "Relaciones actualizadas" : undefined));
    for (const owner of owners) await owner.parent.refresh(tx, actor, owner.previous);
    // Owner hooks may canonicalize the child again. Never return an obsolete revision.
    if (owners.length) {
      const canonical = await repository.read(tx, final.id);
      if (!canonical || !await inScope(tx, canonical.id, scope)) throw new ModelValidationError("La línea ya no está disponible después de validar su documento.");
      const refreshed = await loadDocument(tx, actor, canonical) as Values & Document;
      await presentation.validateRelations?.(tx, actor, refreshed, { id: refreshed.id });
      return refreshed;
    }
    return final;
  }

  async function save(prisma: PrismaClient, actor: ModelActor, input: unknown): Promise<FormViewResult<Values>> {
    try {
      const creatingSequence = hasSequences && Boolean(input && typeof input === "object" && !(input as Record<string, unknown>).id);
      const attempts = creatingSequence ? 5 : 1;
      let record: { values: Values & Document; audit?: import("./audit").RecordAudit; displayName: string } | undefined;
      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          record = await prisma.$transaction(async tx => {
            const values = await persist(tx, actor, input);
            return { values: await publicDocument(tx, actor, values), ...await readAudit(tx, values.id, actor), ...await readDisplayName(tx, actor, values) };
          }, { isolationLevel: "Serializable" });
          break;
        } catch (error) {
          // Only a confirmed serialization abort can replay this local transaction.
          // Never retry network failures, unique conflicts or an unknown commit.
          if (!creatingSequence || codeOf(error) !== "P2034" || attempt === attempts - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)));
        }
      }
      if (!record) throw new ModelValidationError(conflict);
      return { ok: true, ...record, message: "Registro guardado." };
    } catch (error) { return writeFailure(error); }
  }

  function writeFailure(error: unknown): FormViewResult<Values> {
    if (error instanceof ActionParameterError) return { ok: false, kind: "validation", error: error.message, ...(error.parameterErrors ? { parameterErrors: error.parameterErrors } : {}) };
    const validation = error instanceof ModelValidationError || error instanceof z.ZodError || ["P2002", "P2003", "P2018", "P2025", "P2034"].includes(codeOf(error));
    const fieldErrors = error instanceof ModelValidationError ? error.fieldErrors : error instanceof z.ZodError ? Object.fromEntries(error.issues.filter(issue => issue.path.length).map(issue => [issue.path.join("."), issue.message])) : undefined;
    return { ok: false, kind: validation ? "validation" : "server", error: error instanceof z.ZodError ? "Revisa los datos del registro." : messageFor(error), ...(fieldErrors ? { fieldErrors: fieldErrors as Partial<Record<FieldPath<Values>, string>> } : {}) };
  }

  /**
   * Run a business action published by the model (`@action`). One Serializable transaction:
   * write access and record rules, action groups, current revision, the model method, and
   * its patch applied through the same pipeline as save (normalize, Zod, hooks, constraints,
   * tracking). The browser only names a published action; any failure rolls everything back.
   */
  async function action(prisma: PrismaClient, actor: ModelActor, input: unknown): Promise<FormViewResult<Values>> {
    try {
      const request = actionRequestSchema.safeParse(input);
      if (!request.success) throw new ModelValidationError("La acción solicitada no es válida.");
      const declared = model.actions?.find(item => item.name === request.data.action);
      if (!declared || !model.runAction) throw new ModelValidationError("La acción no está publicada en este modelo.");
      const record = await prisma.$transaction(async tx => {
        const scope = await authorize(tx, actor, "write");
        const current = await inScope(tx, request.data.id, scope) ? await repository.read(tx, request.data.id) : null;
        if (!current || current.revision !== request.data.revision) throw new ModelValidationError(conflict);
        const values2 = await persistAction(tx, actor, declared, current, request.data.params);
        return { values: await publicDocument(tx, actor, values2), ...await readAudit(tx, values2.id, actor), ...await readDisplayName(tx, actor, values2) };
      }, { isolationLevel: "Serializable" });
      return { ok: true, ...record, message: `${declared.label}: acción completada.` };
    } catch (error) { return writeFailure(error); }
  }

  /** Shared by form actions and Kanban moves; always uses the caller's transaction. */
  async function persistAction(tx: Prisma.TransactionClient, actor: ModelActor, declared: ModelAction, current: Values, input?: unknown) {
    if (presentation.authorizeAction) await presentation.authorizeAction(tx, actor, declared);
    const policy = await elements(tx, actor);
    if (policy.blockedActions.includes(declared.name) || policy.privateDocument || hasPrivateFields(policy.fields)) throw new AccessError("DENIED");
    if (!model.runAction) throw new ModelValidationError("La acción no está publicada en este modelo.");
    current = await loadDocument(tx, actor, current as Document) as Values;
    if (declared.params && !model.parseActionParams) throw new ActionParameterError("El contrato de parámetros no está cargado.");
    const params = model.parseActionParams ? model.parseActionParams(declared.name, input) : parseActionParameters(undefined, input);
    const access = relationAccessFor(tx, actor);
    for (const [name, field] of Object.entries(declared.params ?? {})) {
      const id = params[name];
      if (field.kind === "many2one" && id !== null && id !== undefined && (!access || !(await access(field.target, [id as string])).has(id as string))) throw new ActionParameterError("Revisa los registros seleccionados.", { [name]: "Selecciona un registro existente y accesible." });
    }
    // The acted record stays in progress: env must not save it under the action (stale revision).
    const patch = await withFrame(tx, { model: model.name, id: (current as Document).id }, () => model.runAction!(declared.name, current, { tx, actor: Object.freeze({ ...actor }), action: declared.name, env: envFor(tx, actor) }, params));
    const { id, revision, ...values } = current;
    return persist(tx, actor, { ...values, ...patch, id, revision }, declared.label, { system: true });
  }

  /** Validated Many2many filter → repository predicate (no IDs from unreadable targets). */
  async function many2manyPredicate(tx: Prisma.TransactionClient, actor: ModelActor, filter: ListFilter) {
    if (!repository.many2manyWhere) throw new ModelValidationError("Este proveedor aún no admite filtros por relaciones múltiples.");
    if (!many2manyFilterOperators.includes(filter.operator)) throw new ModelValidationError("Para relaciones múltiples usa «tiene alguna de», «tiene todas» o vacío.");
    const ids = filter.operator === "any" || filter.operator === "all" ? many2manyFilterIds(filter.value) : [];
    if ((filter.operator === "any" || filter.operator === "all") && (!ids.length || ids.length > 10 || ids.some(id => id.length > 100))) throw new ModelValidationError("Selecciona entre 1 y 10 registros para el filtro.");
    if (ids.length) {
      const access = relationAccessFor(tx, actor);
      const readable = access ? await access(many[filter.field].many2many.target, ids) : new Set<string>();
      if (ids.some(id => !readable.has(id))) throw new ModelValidationError("Revisa los registros del filtro.");
    }
    return repository.many2manyWhere(filter.field, filter.operator as "any" | "all" | "empty" | "notEmpty", ids);
  }

  /** Page rows get the readable linked IDs of every Many2many (labels come from the relation providers). */
  async function withMany2manyIds(tx: Prisma.TransactionClient, rows: readonly ListRecord[], access?: RelationAccess): Promise<ListRecord[]> {
    const fields = Object.keys(many);
    if (!fields.length || !rows.length || !repository.many2manyIds) return [...rows];
    const ids = rows.map(row => row.id);
    const linked = await Promise.all(fields.map(async field => {
      const byRow = await repository.many2manyIds!(tx, field, ids);
      const all = [...new Set([...byRow.values()].flat())];
      const readable = all.length && access ? await access(many[field].many2many.target, all) : new Set<string>();
      return [field, byRow, readable] as const;
    }));
    return rows.map(row => ({ ...row, ...Object.fromEntries(linked.map(([field, byRow, readable]) => [field, (byRow.get(row.id) ?? []).filter(id => readable.has(id))])) }));
  }

  /**
   * `screen` replaces the main collection domain with the one of a named screen chosen by the
   * server registry (`{}` = a screen without domain). Relation sources never use it.
   */
  async function list(prisma: PrismaClient, actor: ModelActor, input: unknown, group?: { field: string; value: string }, domain?: (context: ListDomainContext) => Promise<Record<string, unknown>>, transaction?: Prisma.TransactionClient, collection: "main" | "relation" = "main", screen?: { readonly domain?: CollectionDomain }): Promise<ListResult> {
    try {
      const query = async (tx: Prisma.TransactionClient) => {
        if (computedNames.length && !transaction) await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const scope = await authorize(tx, actor, "read");
        const fixedDomain = domain ? await domain({ actor: Object.freeze({ id: actor.id, sessionVersion: actor.sessionVersion }), tx }) : undefined;
        const elementPolicy = await elements(tx, actor);
        const mainDomain = screen ? screen.domain : presentation.domain;
        const baseDomain = collection === "main" && mainDomain ? await compileCollectionDomain(domainMetadata, mainDomain, { actor: Object.freeze({ ...actor }), tx }) : undefined;
        const parsed = listStateSchema.safeParse(input);
        if (!parsed.success || parsed.data.invalidFilters) throw new ModelValidationError("Revisa los filtros y parámetros de esta lista.");
        if (policy && parsed.data.sort && parsed.data.sort !== "id" && !policy.sortable?.includes(parsed.data.sort)) throw new ModelValidationError("El orden solicitado no está habilitado.");
        if (policy && parsed.data.query && !policy.searchFields.length) throw new ModelValidationError("La búsqueda no está habilitada.");
        const state = normalizeListState(config, parsed.data);
        if (parsed.data.sort && !elementPolicy.canRead([parsed.data.sort])) throw new AccessError("DENIED");
        if (!elementPolicy.canRead([state.sort])) state.sort = "id";
        if (!elementPolicy.canRead([...state.filters.map(filter => filter.field), ...(state.groupBy ?? []), ...(group ? [group.field] : [])])) throw new AccessError("DENIED");
        let grouping: ReturnType<typeof groupingPlan>;
        try { grouping = groupingPlan(config.columns, state); }
        catch (error) { throw new ModelValidationError((error as Error).message); }
        if (new Set(state.filters.map(filter => filter.field)).size !== state.filters.length) throw new ModelValidationError("Usa un filtro por columna.");
        const predicates: Record<string, unknown>[] = group ? [{ [group.field]: group.value }] : [];
        predicates.push(...grouping.predicates);
        if (fixedDomain) predicates.push(fixedDomain);
        if (baseDomain) predicates.push(baseDomain);
        if (scope) predicates.push(scope);
        for (const filter of state.filters) {
          // Many2many (tags): membership/emptiness over the link table; IDs must be readable.
          if (Object.hasOwn(many, filter.field)) { predicates.push(await many2manyPredicate(tx, actor, filter)); continue; }
          const column = config.columns.find(column => column.field === filter.field && column.filterable !== false);
          if (!column || !allowed.has(filter.field)) throw new ModelValidationError("La columna del filtro no está habilitada.");
          const field = model.metadata[filter.field];
          const type = columnType(filter.field);
          const error = filterValueError(type, filter);
          if (error) throw new ModelValidationError(error);
          if (field?.kind === "integer" && [filter.value, filter.to].filter(value => value !== undefined).some(value => Number(value) < INTEGER_MIN || Number(value) > INTEGER_MAX)) throw new ModelValidationError("El filtro está fuera del rango de un entero de 32 bits.");
          if (field?.kind === "selection" && !["eq", "neq", "empty", "notEmpty"].includes(filter.operator)) throw new ModelValidationError("Para una selección utiliza un filtro de igualdad o vacío.");
          if (field?.kind === "selection" && ["eq", "neq"].includes(filter.operator)) {
            if (!field.choices.some(choice => choice.value === filter.value)) throw new ModelValidationError("El valor no corresponde a una opción del campo.");
            predicates.push({ [filter.field]: { [filter.operator === "eq" ? "equals" : "not"]: filter.value } });
          } else if (field?.kind === "selection") {
            const nullable = !field.required || nullableCollection.has(filter.field);
            predicates.push(filter.operator === "empty" ? nullable ? { [filter.field]: null } : { id: { in: [] } } : nullable ? { [filter.field]: { not: null } } : {});
          } else predicates.push(compileColumnFilter(type, filter, nullableCollection.has(filter.field) || (field ? !field.required : ["createBy", "createByUser.name"].includes(filter.field)), presentation.audit ? ["createByUser"] : []));
        }
        if (state.query) {
          const search = config.searchFields.filter(field => elementPolicy.canRead([field]));
          if (!search.length) throw new AccessError("DENIED");
          predicates.push({ OR: search.map(field => compileColumnFilter("text", { field, operator: "contains", value: state.query })) });
        }
        const where = { AND: predicates };
        const total = await repository.count(tx, where);
        if (grouping.field) {
          if (!repository.groups) throw new ModelValidationError("Este proveedor aún no admite agrupación. Actualiza su adaptador con orm:bind.");
          // Bound the offset without enumerating every distinct group key.
          const requestedPage = Math.min(state.page, Math.max(1, Math.ceil(total / state.pageSize)));
          const query = { where, field: grouping.field, skip: (requestedPage - 1) * state.pageSize, take: state.pageSize + 1 };
          let groups = await repository.groups(tx, query);
          const page = !groups.length && requestedPage > 1 ? 1 : requestedPage;
          if (page !== requestedPage) groups = await repository.groups(tx, { ...query, skip: 0 });
          return groupedPage({ ...state, page }, total, groups);
        }
        const page = Math.min(state.page, Math.max(1, Math.ceil(total / state.pageSize)));
        const sourceRows = await repository.list(tx, { where, sort: state.sort, direction: state.direction, skip: (page - 1) * state.pageSize, take: state.pageSize, audit: presentation.audit === true });
        const access = relationAccessFor(tx, actor);
        const relatedRows = await resolveCollectionRelated(tx,sourceRows,config.columns.map(column=>column.field).filter(name=>Object.hasOwn(relatedFields,name) && elementPolicy.canRead([name])),relatedFields,repository,access);
        const rows = await resolveCollectionComputed(relatedRows, computedNames.filter(name => elementPolicy.canRead([name])), model, Object.freeze({ tx, actor: Object.freeze({ ...actor }), env: readEnvFor(tx, actor) }), [...nullableCollection].filter(name => model.metadata[name]?.required));
        const names = elementPolicy.canRead(displayProjectionPaths(model.metadata, model.displayFields)) ? await resolveDisplayNames(tx, sourceRows, model, repository, access) : new Map(sourceRows.map(row => [row.id, row.id]));
        // Repository contracts can contain extra edit fields: collection DTOs honor the fixed server publication.
        const publishedRows = policy ? rows.map(row => projectListRow(row, [...policy.fields, ...policy.fields.flatMap(name => auditAvatarField(name) ? [auditAvatarField(name)!] : [])])) : rows;
        const linkedRows = await withMany2manyIds(tx, publishedRows, access);
        return { rows: linkedRows.map(row => publicFieldValues({ ...row, $displayName: names.get(row.id)! }, elementPolicy)), total, page, pageSize: state.pageSize };
      };
      const data = transaction ? await query(transaction) : await prisma.$transaction(query, { isolationLevel: "RepeatableRead" });
      // Labels use independently authorized lookups after the list snapshot; no cross-request cache.
      // They are presentation, never predicates, ordering keys or authorization inputs.
      return !transaction && presentation.relations ? resolveListLabels({ ok: true, data }, presentation.relations) : { ok: true, data };
    } catch (error) { return { ok: false, error: messageFor(error) }; }
  }

  async function kanban(prisma: PrismaClient, actor: ModelActor, input: KanbanRequest, screen?: { readonly domain?: CollectionDomain }): Promise<ListResult> {
    const request = z.strictObject({ group: z.string().min(1).max(100), state: listStateSchema }).safeParse(input);
    if (!groupField || !request.success || request.data.state.groupBy?.length || request.data.state.groupPath?.length || !groups.some(group => group.value === request.data.group)) return { ok: false, error: "La columna del kanban no está habilitada." };
    return list(prisma, actor, request.data.state, { field: groupField, value: request.data.group }, undefined, undefined, "main", screen);
  }

  async function move(prisma: PrismaClient, actor: ModelActor, input: unknown): Promise<KanbanMoveResult> {
    try {
      await prisma.$transaction(async tx => {
        const scope = await authorize(tx, actor, "write");
        const parsed = z.strictObject({ id: idSchema, revision: z.iso.datetime({ precision: 3 }), from: z.string().min(1).max(100), to: z.string().min(1).max(100) }).safeParse(input);
        if (!groupField || !parsed.success || !groups.some(group => group.value === parsed.data.from) || !groups.some(group => group.value === parsed.data.to)) throw new ModelValidationError("El movimiento no corresponde a los estados permitidos.");
        const policy = await elements(tx, actor);
        if (!policy.canRead([groupField]) || policy.fields[groupField]?.noWrite || policy.privateDocument || hasPrivateFields(policy.fields)) throw new AccessError("DENIED");
        const current = await inScope(tx, parsed.data.id, scope) ? await repository.read(tx, parsed.data.id) : null;
        if (!current || current.revision !== parsed.data.revision || current[groupField] !== parsed.data.from) throw new ModelValidationError(conflict);
        if (parsed.data.from === parsed.data.to) return;
        if (kanbanConfig?.transitions !== undefined) {
          const route = kanbanConfig.transitions.find(route => route.from === parsed.data.from && route.to === parsed.data.to);
          if (!route) throw new ModelValidationError("La transición solicitada no está permitida.");
          const declared = model.actions?.find(action => action.name === route.action);
          if (!declared) throw new ModelValidationError("La acción no está publicada en este modelo.");
          const saved = await persistAction(tx, actor, declared, current);
          if (saved[groupField] !== parsed.data.to) throw new ModelValidationError("La acción no dejó el registro en el estado de destino. Se revirtió el movimiento.");
        } else await persist(tx, actor, { ...await loadDocument(tx, actor, current), [groupField]: parsed.data.to });
      }, { isolationLevel: "Serializable" });
      return { ok: true };
    } catch (error) { return { ok: false, kind: error instanceof ModelValidationError || error instanceof z.ZodError || ["P2002", "P2003", "P2025", "P2034"].includes(codeOf(error)) ? "validation" : "server", error: messageFor(error) }; }
  }

  /** Define on the server. The returned loader receives state, never a domain from the browser. */
  function defineListAction(options: ListActionOptions<T> = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some(key => key !== "domain")) throw new Error("La acción de lista sólo acepta domain del servidor.");
    const source = options.domain;
    const dynamic = typeof source === "function" ? source : undefined;
    // Validate and snapshot static declarations immediately; callbacks run after session revalidation.
    const fixed = dynamic ? undefined : compileListDomain(domainMetadata, source === undefined ? [] : source);
    const resolve = async (context: ListDomainContext) => {
      if (!dynamic) return fixed!;
      const result = await dynamic(Object.assign({}, domainBuilderFor<import("./domain").DomainField<T>>(), context));
      return compileListDomain(domainMetadata, Array.isArray(result) ? result : [result]);
    };
    return (prisma: PrismaClient, actor: ModelActor, input: unknown) => list(prisma, actor, input, undefined, resolve);
  }

  /** Server-only relation source: bind its inverse instead of inheriting the main collection domain. */
  function defineChildListAction(inverse: string, parentId: string) {
    const field = model.metadata[inverse];
    if (field?.kind !== "many2one" || field.sensitive) throw new Error("La colección de consulta requiere una inversa Many2one pública.");
    const fixed = compileListDomain(domainMetadata, [{ field: inverse, operator: "eq", value: parentId }]);
    return (prisma: PrismaClient, actor: ModelActor, input: unknown) => list(prisma, actor, input, undefined, async () => fixed, undefined, "relation");
  }

  function remove(prisma: PrismaClient, actor: ModelActor, input: unknown): Promise<ListDeleteResult> {
    let scope: Record<string, unknown> | undefined;
    return deleteListSelection(prisma, actor, input, {
      // Records outside the rules read as missing: the whole batch is rejected as a conflict.
      read: async (tx, id) => await inScope(tx, id, scope) ? repository.read(tx, id) : null,
      remove: async (tx, id, revision) => {
        if (!repository.remove) throw new Error("MODEL_NOT_BOUND");
        await transaction.remove(tx, actor, id, revision);
      },
    }, undefined, presentation.authorize ? async (tx, actor) => { scope = await authorize(tx, actor, "unlink"); } : undefined);
  }

  async function assertActivityRecord(tx: Prisma.TransactionClient, actor: ModelActor, id: string, operation: ServiceOperation) {
    const scope = await authorize(tx, actor, operation);
    if (!await inScope(tx, id, scope) || !await repository.read(tx, id)) throw new ModelValidationError("El registro ya no está disponible.");
  }

  async function activity(prisma: PrismaClient, actor: ModelActor, input: unknown): Promise<ActivityResult> {
    try {
      const parsed = activityRequestSchema.safeParse(input);
      if (!parsed.success) throw new ModelValidationError("La consulta de actividad no es válida.");
      const data = await prisma.$transaction(async tx => {
        await assertActivityRecord(tx, actor, parsed.data.id, "read");
        const page = await readActivity(tx, model.name, model.metadata, parsed.data, presentation.activityLabels
          ? (target, ids) => presentation.activityLabels!(tx, actor, target, ids) : undefined);
        const policy = await elements(tx, actor);
        const authorReadable = policy.canRead(["createByUser.login", "createByUser.name", "createByUser.avatarUrl"]);
        return { ...page, entries: page.entries.map(entry => ({ ...entry, changes: entry.changes.filter(change => policy.canRead([change.field]) && !policy.fields[change.field]?.noRead), ...(authorReadable ? {} : { author: { id: entry.author.id, login: "", name: "Usuario", avatarUrl: null } }) })) };
      }, { isolationLevel: "RepeatableRead" });
      return { ok: true, data };
    } catch (error) { return { ok: false, error: messageFor(error) }; }
  }

  async function addNote(prisma: PrismaClient, actor: ModelActor, input: unknown): Promise<ActivityNoteResult> {
    try {
      const parsed = activityNoteSchema.safeParse(input);
      if (!parsed.success) throw new ModelValidationError("Escribe una nota de entre 1 y 4000 caracteres.");
      const { id, body, requestId } = parsed.data;
      await prisma.$transaction(async tx => {
        await assertActivityRecord(tx, actor, id, "write");
        // Retrying a request after an unknown network outcome must not duplicate its note.
        const note = await tx.recordActivity.upsert({
          where: { actorId_requestId: { actorId: actor.id, requestId } }, update: {},
          create: { model: model.name, recordId: id, actorId: actor.id, kind: "note", body, requestId },
          select: { model: true, recordId: true, kind: true, body: true },
        });
        if (note.model !== model.name || note.recordId !== id || note.kind !== "note" || note.body !== body) throw new ModelValidationError("La solicitud de la nota ya se utilizó con otro contenido.");
      }, { isolationLevel: "Serializable" });
      return { ok: true };
    } catch (error) { return { ok: false, error: messageFor(error) }; }
  }

  async function lookup(prisma: PrismaClient, actor: ModelActor, input: unknown): Promise<Many2OneResult> {
    try {
      const request = modelLookupSchema.parse(input);
      return await prisma.$transaction(tx => lookupInTransaction(tx, actor, request), { isolationLevel: "RepeatableRead" });
    } catch (error) { return { ok: false, error: messageFor(error) }; }
  }

  /** Server-only nested lookup: keeps authorization and projections in the caller's transaction. */
  async function lookupInTransaction(tx: Prisma.TransactionClient, actor: ModelActor, input: unknown, domain?: Record<string, unknown>) {
    const request = modelLookupSchema.parse(input);
    const scope = await authorize(tx, actor, "read");
    if (!repository.lookup) throw new Error("MODEL_NOT_BOUND");
    const policy = await elements(tx, actor);
    const displayReadable = policy.canRead(displayProjectionPaths(model.metadata, model.displayFields));
    const fields = displayReadable ? displayProjectionPaths(model.metadata, model.displayFields) : ["id"];
    if (fields.some(field => field.includes(".") && !repository.lookupPaths?.includes(field))) throw new Error("MODEL_NOT_BOUND");
    const search = config.searchFields.filter(field => model.metadata[field]?.kind === "text" && !model.metadata[field].sensitive && policy.canRead([field]));
    const predicates: Record<string, unknown>[] = scope ? [scope] : [];
    if (domain) predicates.push(domain);
    if (request.id) predicates.push({ id: request.id });
    if (request.ids) predicates.push({ id: { in: request.ids } });
    for (const word of request.query.trim().split(/\s+/).filter(Boolean)) {
      predicates.push(search.length ? { OR: search.map(field => ({ [field]: { contains: word.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" } })) } : { id: { in: [] } });
    }
    const where = { AND: predicates };
    const total = await repository.count(tx, where);
    const pageSize = request.ids?.length ?? request.pageSize;
    const page = request.ids ? 1 : Math.min(request.page, Math.max(1, Math.ceil(total / pageSize)));
    const records = total ? await repository.lookup(tx, { fields, where, skip: (page - 1) * pageSize, take: pageSize, ...(presentation.relationAccess ? { access: relationAccessFor(tx, actor) } : {}) }) : [];
    return { ok: true as const, total, page, pageSize, items: records.map(row => {
      if (typeof row.id !== "string") throw new Error("Invalid lookup record");
      // Only the label and ID leave this service, never the inputs used to construct it.
      const label = displayReadable ? modelDisplayName(model, row) : row.id;
      return { value: row.id, label, record: { id: row.id } };
    }) };
  }

  async function react(prisma:PrismaClient,actor:ModelActor,input:unknown):Promise<ReactionResult> {
    try {
      const request=z.strictObject({field:z.string().min(1).max(60),values:z.record(z.string(),z.unknown()),id:idSchema.optional(),revision:z.iso.datetime({precision:3}).optional()}).parse(input);
      if(JSON.stringify(request.values).length>16000 || !recordIdentitySchema.safeParse({id:request.id,revision:request.revision}).success) throw new ModelValidationError("El borrador no es válido.");
      if(!model.react || !model.reactionRules?.some(rule=>rule.fields.includes(request.field))) throw new ModelValidationError("La reacción no está habilitada.");
      const result=await prisma.$transaction(async tx=>{
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const scope=await authorize(tx,actor,request.id?"write":"create");
        const policy = await elements(tx, actor);
        const rules = model.reactionRules?.filter(rule => rule.fields.includes(request.field)) ?? [];
        if (!policy.canRead([request.field, ...Object.keys(request.values), ...rules.flatMap(rule => [...rule.reads, ...rule.preview])])) throw new AccessError("DENIED");
        if(request.id) {
          const current=await inScope(tx,request.id,scope)?await repository.read(tx,request.id):null;
          if(!current || current.revision!==request.revision) throw new ModelValidationError(conflict);
        }
        const result = await model.react!(request.field,request.values,Object.freeze({tx,actor:Object.freeze({...actor}),id:request.id,env:readEnvFor(tx,actor),
          resolveRelated: repository.related ? (access => (field:string,id:string) => repository.related!(tx,field,id,access))(relationAccessFor(tx,actor)) : undefined,
        }));
        return { patch: Object.fromEntries(Object.entries(publicFieldValues(result.patch, policy)).filter(([name]) => !policy.fields[name]?.noWrite)), preview: publicFieldValues(result.preview, policy) };
      },{isolationLevel:"RepeatableRead"});
      return {ok:true,...result};
    } catch(error) {
      return {ok:false,error:error instanceof z.ZodError?"Revisa los campos necesarios para esta reacción.":messageFor(error),...(error instanceof ModelValidationError&&error.fieldErrors?{fieldErrors:error.fieldErrors}:{})};
    }
  }

  /**
   * Read-only facade of this model for `context.env` of other models: same transaction and actor,
   * group access, record rules and field read policies. Plain frozen rows, never lazy relations.
   */
  const envFields = new Set(Object.entries(model.metadata).filter(([, field]) => !field.sensitive && !field.related && !field.compute && !(field.kind === "text" && field.writeOnly)).map(([name]) => name));
  const envLabel = `env.${model.name}`;
  const domainFields = (node: DomainExpression): string[] => "all" in node ? node.all.flatMap(domainFields) : "any" in node ? node.any.flatMap(domainFields) : "not" in node ? domainFields(node.not) : [node.field];
  function environment(tx: Prisma.TransactionClient, actor: ModelActor): ModelEnvironmentModel {
    const checkFields = (fields: unknown) => {
      if (!Array.isArray(fields) || !fields.length || fields.length > 30 || new Set(fields).size !== fields.length) throw new ModelValidationError(`${envLabel}: indica entre 1 y 30 campos distintos.`);
      const unknown = fields.filter(name => typeof name !== "string" || !envFields.has(name));
      if (unknown.length) throw new ModelValidationError(`${envLabel}: campos no disponibles: ${unknown.map(String).join(", ")}. Sólo campos persistentes públicos.`);
      return fields as string[];
    };
    const compileDomain = (domain: EnvironmentDomain<Record<string, unknown>> | null | undefined) => {
      if (domain === null || domain === undefined) return { where: undefined, fields: [] as string[] };
      if (typeof domain !== "function") throw new ModelValidationError(`${envLabel}: el dominio debe ser una función d => ...`);
      const expression = snapshotDomain(domain(domainBuilder as never));
      if (domainDependencies(expression).length || domainUsesRecordId(expression)) throw new ModelValidationError(`${envLabel}: el dominio no admite d.draft ni d.record; usa valores concretos.`);
      const fields = domainFields(expression).filter(name => name !== "id");
      const unknown = fields.filter(name => !envFields.has(name));
      if (unknown.length) throw new ModelValidationError(`${envLabel}: el dominio usa campos no disponibles: ${unknown.join(", ")}.`);
      return { where: compileListDomain(domainMetadata, [expression]), fields };
    };
    // Group access + record rules (scope) + field read policies, revalidated per call in this tx.
    const prepare = async (fields: readonly string[], where?: Record<string, unknown>) => {
      const scope = await authorize(tx, actor, "read");
      const policy = await elements(tx, actor);
      if (!policy.canRead([...new Set(fields)])) throw new AccessError("DENIED");
      return { AND: [...(scope ? [scope] : []), ...(where ? [where] : [])] };
    };
    const project = (row: Record<string, unknown>, fields: readonly string[]) => Object.freeze(Object.fromEntries([["id", row.id], ...fields.map(name => [name, row[name] ?? null])]));
    const rows = (where: Record<string, unknown>, sort: string, direction: "asc" | "desc", skip: number, take: number) =>
      repository.list(tx, { where, sort, direction, skip, take, audit: false }) as Promise<Record<string, unknown>[]>;
    const facade: ModelEnvironmentModel = {
      async search(domain, options) {
        if (!options || typeof options !== "object") throw new ModelValidationError(`${envLabel}.search: indica { fields }.`);
        const fields = checkFields(options.fields);
        const limit = options.limit ?? 100, offset = options.offset ?? 0, order = options.order ?? "id", direction = options.direction ?? "asc";
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500 || !Number.isSafeInteger(offset) || offset < 0) throw new ModelValidationError(`${envLabel}.search: limit es de 1 a 500 y offset no negativo.`);
        if (order !== "id" && !envFields.has(order)) throw new ModelValidationError(`${envLabel}.search: no se puede ordenar por ${String(order)}.`);
        if (direction !== "asc" && direction !== "desc") throw new ModelValidationError(`${envLabel}.search: direction es asc o desc.`);
        const compiled = compileDomain(domain);
        const where = await prepare([...fields, ...compiled.fields, ...(order === "id" ? [] : [order])], compiled.where);
        return Object.freeze((await rows(where, order, direction, offset, limit)).map(row => project(row, fields))) as never;
      },
      async readMany(ids, fields) {
        const names = checkFields(fields);
        if (!Array.isArray(ids) || ids.length > 500 || ids.some(id => typeof id !== "string" || !id.trim() || id.length > 100)) throw new ModelValidationError(`${envLabel}.readMany: indica hasta 500 IDs válidos.`);
        const unique = [...new Set(ids)];
        if (!unique.length) return Object.freeze([]) as never;
        const where = await prepare(names, { id: { in: unique } });
        const found = new Map((await rows(where, "id", "asc", 0, unique.length)).map(row => [row.id as string, project(row, names)]));
        return Object.freeze(ids.flatMap(id => found.has(id) ? [found.get(id)!] : [])) as never;
      },
      async read(id, fields) {
        if (typeof id !== "string") throw new ModelValidationError(`${envLabel}.read: el ID debe ser texto.`);
        return ((await facade.readMany([id], fields))[0] ?? null) as never;
      },
      async count(domain) {
        const compiled = compileDomain(domain);
        return repository.count(tx, await prepare(compiled.fields, compiled.where));
      },
      // Writes reuse this model's own save/remove pipeline: create/write/unlink access, record
      // rules, field write policies, normalize, Zod, hooks, constraints, relations and history.
      async create(values) {
        const input = checkValues(values, "create");
        return nestedWrite(tx, model.name, async () => saved(await persist(tx, actor, { ...(model.createDefaults?.() ?? {}), ...input })));
      },
      async write(id, values) {
        checkId(id, "write");
        const input = checkValues(values, "write");
        return nestedWrite(tx, model.name, async () => {
          // The current revision is read here, in the caller's transaction: no client revision exists.
          const current = await transaction.snapshot(tx, actor, id, "write");
          if (!current) throw new ModelValidationError(`${envLabel}.write: el registro no existe o no puedes modificarlo.`);
          const { id: _id, revision, ...document } = current;
          void _id;
          return saved(await persist(tx, actor, { ...document, ...input, id, revision }));
        });
      },
      async unlink(id) {
        checkId(id, "unlink");
        await nestedWrite(tx, model.name, async () => {
          const scope = await authorize(tx, actor, "unlink");
          const current = await inScope(tx, id, scope) ? await repository.read(tx, id) : null;
          if (!current) throw new ModelValidationError(`${envLabel}.unlink: el registro no existe o no puedes eliminarlo.`);
          await transaction.remove(tx, actor, id, current.revision);
        });
      },
    };
    function checkId(id: unknown, operation: string): asserts id is string {
      if (typeof id !== "string" || !id.trim() || id.length > 100) throw new ModelValidationError(`${envLabel}.${operation}: el ID no es válido.`);
    }
    function checkValues(values: unknown, operation: string) {
      if (!values || typeof values !== "object" || Array.isArray(values) || Object.getPrototypeOf(values) !== Object.prototype) throw new ModelValidationError(`${envLabel}.${operation}: indica un objeto de valores.`);
      const keys = Object.keys(values);
      const unknown = keys.filter(name => !envFields.has(name));
      if (unknown.length) throw new ModelValidationError(`${envLabel}.${operation}: campos no disponibles: ${unknown.join(", ")}. Sólo campos persistentes públicos.`);
      if (operation === "write" && !keys.length) throw new ModelValidationError(`${envLabel}.write: indica al menos un campo.`);
      return values as Record<string, unknown>;
    }
    // Only what the actor may read leaves the target service.
    async function saved(record: Values & Document) {
      const visible = await publicDocument(tx, actor, record);
      return Object.freeze(Object.fromEntries([["id", record.id], ...[...envFields].filter(name => Object.hasOwn(visible, name)).map(name => [name, visible[name] ?? null])])) as never;
    }
    return Object.freeze(facade);
  }

  const transaction: TransactionModel = {
    name: model.name, metadata: model.metadata, lines,
    prepareInput: prepareDocumentInput,
    present: (tx, actor, record) => publicDocument(tx, actor, record as Values & Document),
    async snapshot(tx, actor, id, operation = "read") {
      const scope = await authorize(tx, actor, operation);
      const row = await inScope(tx, id, scope) ? await repository.read(tx, id) : null;
      return row ? loadDocument(tx, actor, row) : null;
    },
    async owned(tx, actor, inverse, id, maximum) {
      const field = model.metadata[inverse];
      if (field?.kind !== "many2one") throw new Error("Relación inversa no publicada.");
      const scope = await authorize(tx, actor, "read");
      const where = { [inverse]: id };
      const total = await repository.count(tx, where);
      if (scope && await repository.count(tx, { AND: [where, scope] }) !== total) throw new ModelValidationError("No se puede abrir la colección completa de líneas con tus permisos.");
      if (total > maximum) throw new ModelValidationError(`La colección supera el límite de ${maximum} líneas editables del registro padre.`);
      const rows = await repository.list(tx, { where: scope ? { AND: [where, scope] } : where, sort: "id", direction: "asc", skip: 0, take: maximum + 1 });
      if (rows.length !== total) throw new ModelValidationError("La colección de líneas cambió. Recarga el documento.");
      const documents = rows.map(row => projectListRow(row, Object.keys(model.metadata)) as Document);
      if (!Object.keys(lines).length) return documents;
      const nested: Document[] = [];
      for (const row of documents) nested.push(await loadLines(tx, actor, row, lines) as Document);
      return nested;
    },
    persist: (tx, actor, input, label, options) => persist(tx, actor, input, label, options) as Promise<Document>,
    async remove(tx, actor, id, revision, options) {
      const scope = await authorize(tx, actor, "unlink");
      const current = await inScope(tx, id, scope) ? await repository.read(tx, id) : null;
      if (!current || current.revision !== revision) throw new ModelValidationError(conflict);
      const owners = await captureOwners(tx, actor, current, current, presentation.owners ?? [], options);
      if (!repository.remove) throw new Error("MODEL_NOT_BOUND");
      await withFrame(tx, { model: model.name, id }, async () => {
        await model.beforeRemove?.(current as Readonly<Record<string, unknown>>, { tx, actor, id, env: envFor(tx, actor) });
        if (options?.withLines && Object.keys(lines).length) {
          const document = await loadLines(tx, actor, current as Document, lines);
          for (const [name, relation] of Object.entries(lines)) for (const row of document[name] as Document[]) await relation.child().remove(tx, actor, row.id, row.revision, { skipOwner: { model: model.name, id }, withLines: true });
        }
        await repository.remove!(tx, id, revision);
      });
      for (const owner of owners) await owner.parent.refresh(tx, actor, owner.previous);
    },
    async refresh(tx, actor, previous) {
      const current = await transaction.snapshot(tx, actor, previous.id, "write");
      if (!current || current.revision !== previous.revision) throw new ModelValidationError(conflict);
      await persist(tx, actor, current, "Líneas actualizadas", { previous, system: true });
    },
  };
  async function findUniqueInTransaction(tx: Prisma.TransactionClient, actor: ModelActor, field: string | readonly string[], value: unknown, scalar = false) {
    const keys = typeof field === "string" ? [field] : field;
    const unique = keys.length === 1 ? keys[0] === "id" || model.metadata[keys[0]]?.unique : model.uniqueTogether?.some(group => group.length === keys.length && group.every(key => keys.includes(key)));
    if (!unique || !repository.lookup || keys.some(key => key !== "id" && (!model.metadata[key] || model.metadata[key].sensitive))) throw new ModelValidationError("La clave de importación no está habilitada.");
    const values = typeof field === "string" ? { [field]: value } : value as Record<string, unknown>;
    if (!values || typeof values !== "object" || Object.keys(values).length !== keys.length || keys.some(key => !Object.hasOwn(values, key) || values[key] === null || values[key] === undefined || values[key] === "")) throw new ModelValidationError("La clave de importación está incompleta.");
    const scope = await authorize(tx, actor, "read");
    const rows = await repository.lookup(tx, { fields: ["id"], where: { AND: [values, ...(scope ? [scope] : [])] }, skip: 0, take: 2 });
    if (rows.length > 1) throw new ModelValidationError("La clave de importación no es única.");
    return rows[0] ? scalar ? repository.read(tx, String(rows[0].id)) : transaction.snapshot(tx, actor, String(rows[0].id)) : null;
  }
  return { transaction, environment, findUniqueInTransaction, listInTransaction: (prisma: PrismaClient, tx: Prisma.TransactionClient, actor: ModelActor, input: unknown) => list(prisma, actor, input, undefined, undefined, tx), react, read, save, action, actions: model.actions ?? [], remove, activity, addNote, lookup, lookupInTransaction, list: (prisma: PrismaClient, actor: ModelActor, input: unknown, screen?: { readonly domain?: CollectionDomain }) => list(prisma, actor, input, undefined, undefined, undefined, "main", screen), defineListAction, defineChildListAction, kanban, move };
}
