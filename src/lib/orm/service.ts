import "server-only";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { FieldPath } from "react-hook-form";
import type { FormViewLoadResult } from "@/components/ui/form/FormViewLoader";
import type { FormViewResult } from "@/components/ui/form/formView.types";
import { AccessError } from "../auth/policy";
import { listStateSchema } from "../list/query";
import { normalizeListState } from "../list/state";
import { compileColumnFilter, filterValueError } from "../list/filters";
import type { ListColumn, ListDataType, ListResult, ListViewConfig } from "../list/types";
import { validImageColumnOptions } from "../list/types";
import { recordIdentitySchema, type RecordIdentity } from "./record";
import { ModelValidationError, type ModelActor, type ModelContext } from "./context";
import type { ModelRepository } from "./repository";
import { INTEGER_MIN, INTEGER_MAX, type FieldMetadata, type Field } from "./fields";
import { resolveCollectionRelated } from "./collection-related";
import type { KanbanMoveResult, KanbanRequest } from "../kanban/types";
import { auditAvatarField, auditColumnType } from "./audit";
import { compileListDomain, type ListActionOptions, type ListDomainContext } from "./domain";
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
import { displayProjectionPaths } from "./display";
import { modelDisplayName, resolveDisplayNames } from "./display.server";

const conflict = "El registro cambió desde que lo abriste. Recarga sus datos antes de guardar.";
type Contract<T extends Record<string, unknown>> = {
  readonly relatedFields?:Readonly<Record<string,Field>>;
  reactionRules?:readonly ReactionRule[];
  react?(field:string,values:Readonly<Record<string,unknown>>,context:ReactionContext):Promise<{patch:Record<string,unknown>;preview:Record<string,string|number|boolean|null>}>;
  name: string; schema: z.ZodType<T>; metadata: Readonly<Record<string, FieldMetadata>>;
  normalize?(values: Record<string, unknown>): T;
  beforeSave?(values: T, context: ModelContext<T>): Promise<T>;
  afterSave?(record: Record<string, unknown>, context: ModelContext<T>): Promise<void>;
  readonly displayFields?: readonly string[];
  displayName?(record: Readonly<Record<string, unknown>>): string;
};
const idSchema = z.string().trim().min(1).max(100);
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
  defaultSort?: ListViewConfig["defaultSort"]; kanban?: { field: string }; audit?: boolean;
  relations?: Readonly<Record<string, Many2OneLoader>>;
  authorize?: ServiceAuthorizer;
} & ({ list: ModelListPolicy; columns?: never; searchFields?: never } | { list?: never; columns: readonly ListColumn[]; searchFields: readonly string[] });

/** Admin-only baseline. The repository and list policy are fixed on the server, never selected by a client. */
export function createModelService<T extends Record<string, unknown>>(model: Contract<T>, repository: ModelRepository<T>, presentation: ServicePresentation) {
  type Values = T & RecordIdentity;
  const auditFields = new Set(presentation.audit ? ["createdAt", "updatedAt", "createBy", "createByUser.login", "createByUser.partner.name"] : []);
  const policy = presentation.list;
  const relatedFields=model.relatedFields??{};
  const collectionMetadata:Readonly<Record<string,FieldMetadata>>={...model.metadata,...Object.fromEntries(Object.entries(relatedFields).map(([name,field])=>[name,{...field.metadata,readOnly:true}]))};
  if (policy && (presentation.columns || presentation.searchFields)) throw new Error("Usa list o columns, no ambas políticas.");
  if (policy) {
    for (const names of [policy.searchFields, policy.sortable ?? [], policy.groupable ?? [], policy.filterable ?? []]) {
      if (new Set(names).size !== names.length || names.some(name => !policy.fields.includes(name) || Object.hasOwn(relatedFields,name))) throw new Error("La política sólo puede consultar campos persistentes publicados en list.fields; related es de lectura.");
    }
    if (policy.fields.some(name => (!Object.hasOwn(collectionMetadata, name) && !auditFields.has(name)) || collectionMetadata[name]?.sensitive)) throw new Error("list.fields sólo permite campos declarados no sensibles.");
  }
  const config: ListViewConfig = { model: model.name, defaultSort: presentation.defaultSort,
    columns: policy ? policy.fields.map(name => ({ ...(collectionMetadata[name] ? fieldColumn(name, collectionMetadata[name]) : { field: name, label: name, ...(auditAvatarField(name) ? { widget: "partner" as const, avatarField: auditAvatarField(name)! } : {}) }), sortable: policy.sortable?.includes(name) ?? false, groupable: policy.groupable?.includes(name) ?? false, filterable: policy.filterable?.includes(name) ?? false })) : presentation.columns!,
    searchFields: policy?.searchFields ?? presentation.searchFields!,
  };
  for (const [name, loader] of Object.entries(presentation.relations ?? {})) {
    if (model.metadata[name]?.kind !== "many2one" || model.metadata[name].sensitive || typeof loader !== "function" || !config.columns.some(column => column.field === name)) throw new Error("Las etiquetas requieren una relación publicada y un lookup autorizado.");
  }
  const allowed = new Set(["id", ...Object.keys(collectionMetadata)]);
  if (presentation.audit) for (const field of ["createdAt", "updatedAt", "createBy", "createByUser.login", "createByUser.partner.name"]) allowed.add(field);
  const columnType = (field: string) => collectionMetadata[field] ? fieldListType(collectionMetadata[field]) : presentation.audit ? auditColumnType(field) ?? "text" : "text";
  if (!config.columns.length || config.columns.length > 12 || new Set(config.columns.map(column => column.field)).size !== config.columns.length || config.columns.some(column => {
    const avatar = presentation.audit && auditAvatarField(column.field);
    const image = column.widget === "image" && collectionMetadata[column.field]?.kind === "image" && !collectionMetadata[column.field].sensitive && (!column.format || column.format === "text");
    const relation = column.widget === "many2one" && model.metadata[column.field]?.kind === "many2one" && !model.metadata[column.field].sensitive && (!column.format || column.format === "text");
    return !allowed.has(column.field) || (Object.hasOwn(relatedFields,column.field) && (column.sortable || column.filterable || column.groupable)) || !validImageColumnOptions(column) || (column.widget && !(image || relation || (column.widget === "partner" && avatar && (!column.avatarField || column.avatarField === avatar) && (!column.format || column.format === "text")))) || (column.avatarField !== undefined && (column.widget !== "partner" || column.avatarField !== avatar)) || (column.type && column.type !== columnType(column.field));
  }) || config.searchFields.length > 6 || config.searchFields.some(name => name !== "id" && model.metadata[name]?.kind !== "text" && model.metadata[name]?.kind !== "many2one" && !(presentation.audit && ["createByUser.login", "createByUser.partner.name"].includes(name)))) throw new Error("La lista sólo puede publicar campos declarados o auditoría habilitada y búsquedas de texto permitidas.");
  // Normalize date types for server filters even when the view omitted an explicit type.
  config.columns = config.columns.map(column => ({ ...column, type: columnType(column.field), ...(Object.hasOwn(relatedFields,column.field)?{filterable:false,sortable:false,groupable:false}:{}), ...(column.widget === "partner" && auditAvatarField(column.field) ? { avatarField: auditAvatarField(column.field)! } : {}) }));
  const authorize: ServiceAuthorizer = presentation.authorize ?? (async (tx, actor) => { await assertActor(tx, actor); return undefined; });
  /** Record rules: the record must exist and satisfy the predicate returned by authorize. */
  async function inScope(tx: Prisma.TransactionClient, id: string, scope: Record<string, unknown> | undefined) {
    return !scope || await repository.count(tx, { AND: [{ id }, scope] }) > 0;
  }
  async function readAudit(tx: Prisma.TransactionClient, id: string) {
    if (!presentation.audit) return {};
    if (!repository.audit) throw new Error("MODEL_NOT_BOUND");
    const audit = await repository.audit(tx, id);
    if (!audit) throw new ModelValidationError("El registro ya no está disponible.");
    return { audit };
  }
  async function readDisplayName(tx: Prisma.TransactionClient, values: Values) {
    const names = await resolveDisplayNames(tx, [values], model, repository);
    return { displayName: names.get(values.id!)! };
  }
  if (config.defaultSort && !config.columns.some(column => column.field === config.defaultSort?.field && column.sortable)) throw new Error("El orden predeterminado debe apuntar a una columna ordenable de la lista.");
  const groupField = presentation.kanban?.field;
  if (policy && groupField && !policy.fields.includes(groupField)) throw new Error("El estado kanban debe estar publicado en list.fields.");
  const groupMetadata = groupField && Object.hasOwn(model.metadata, groupField) ? model.metadata[groupField] : null;
  if (groupField && (groupMetadata?.kind !== "selection" || !groupMetadata.required || groupMetadata.choices.length > 12)) throw new Error("El kanban inicial requiere una selección obligatoria con un máximo de 12 estados.");
  const groups = groupMetadata?.kind === "selection" ? groupMetadata.choices : [];

  async function read(prisma: PrismaClient, actor: ModelActor, input: unknown): Promise<FormViewLoadResult<Values>> {
    try {
      const record = await prisma.$transaction(async tx => {
        const scope = await authorize(tx, actor, "read");
        const id = idSchema.safeParse(input);
        if (!id.success) throw new ModelValidationError("El registro no es válido.");
        // Records outside the rules behave as not found, without revealing that they exist.
        if (!await inScope(tx, id.data, scope)) return null;
        const values = await repository.read(tx, id.data);
        return values ? { values, ...await readAudit(tx, id.data), ...await readDisplayName(tx, values) } : null;
      }, { isolationLevel: "RepeatableRead" });
      return record ? { ok: true, ...record } : { ok: false, error: "No se encontró este registro." };
    } catch (error) { return { ok: false, kind: error instanceof ModelValidationError ? "validation" : "server", error: messageFor(error) }; }
  }

  async function persist(tx: Prisma.TransactionClient, actor: ModelActor, input: unknown) {
    const updating = Boolean(input && typeof input === "object" && !Array.isArray(input) && (input as Record<string, unknown>).id);
    const scope = await authorize(tx, actor, updating ? "write" : "create");
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ModelValidationError("Revisa los datos del registro.");
    const { id, revision, ...fields } = input as Record<string, unknown>;
    const identity = recordIdentitySchema.safeParse({ id, revision });
    // Reject forged/unknown fields before any model code can discard them.
    if (Object.keys(fields).some(key => !Object.hasOwn(model.metadata, key))) throw new ModelValidationError("El registro contiene campos no declarados.");
    if (!identity.success) {
      const errors: Record<string, string> = {};
      for (const issue of identity.error.issues) if (issue.path.length) errors[issue.path.join(".")] ??= issue.message;
      throw new ModelValidationError("Revisa los datos del registro.", errors);
    }
    const metadata = identity.data;
    const current = metadata.id && await inScope(tx, metadata.id, scope) ? await repository.read(tx, metadata.id) : null;
    if (metadata.id) {
      if (!current || current.revision !== metadata.revision) throw new ModelValidationError(conflict);
    }
    const context: ModelContext<T> = Object.freeze({ tx, actor: Object.freeze({ ...actor }), operation: metadata.id ? "update" : "create", id: metadata.id, previous: current ? Object.freeze({ ...current }) : null });
    const normalized = model.schema.parse(model.normalize ? model.normalize(fields) : fields);
    const values = model.schema.parse(model.beforeSave ? await model.beforeSave(normalized, context) : normalized);
    const saved = metadata.id ? await repository.update(tx, metadata.id, metadata.revision!, values) : await repository.create(tx, values, actor.id);
    await model.afterSave?.(saved, context);
    const final = await repository.read(tx, saved.id);
    if (!final) throw new ModelValidationError("El registro no está disponible después de guardar.");
    // The saved values must stay inside the actor's rules; otherwise the transaction rolls back.
    if (!await inScope(tx, final.id, scope)) throw new AccessError("DENIED");
    await recordActivity(tx, model.name, actor.id, model.metadata, current, final);
    return final;
  }

  async function save(prisma: PrismaClient, actor: ModelActor, input: unknown): Promise<FormViewResult<Values>> {
    try {
      const record = await prisma.$transaction(async tx => {
        const values = await persist(tx, actor, input);
        return { values, ...await readAudit(tx, values.id), ...await readDisplayName(tx, values) };
      }, { isolationLevel: "Serializable" });
      return { ok: true, ...record, message: "Registro guardado." };
    } catch (error) {
      const validation = error instanceof ModelValidationError || error instanceof z.ZodError || ["P2002", "P2003", "P2018", "P2025", "P2034"].includes(codeOf(error));
      const fieldErrors = error instanceof ModelValidationError ? error.fieldErrors : error instanceof z.ZodError ? Object.fromEntries(error.issues.filter(issue => issue.path.length).map(issue => [issue.path.join("."), issue.message])) : undefined;
      return { ok: false, kind: validation ? "validation" : "server", error: error instanceof z.ZodError ? "Revisa los datos del registro." : messageFor(error), ...(fieldErrors ? { fieldErrors: fieldErrors as Partial<Record<FieldPath<Values>, string>> } : {}) };
    }
  }

  async function list(prisma: PrismaClient, actor: ModelActor, input: unknown, group?: { field: string; value: string }, domain?: (context: ListDomainContext) => Promise<Record<string, unknown>>): Promise<ListResult> {
    try {
      const data = await prisma.$transaction(async tx => {
        const scope = await authorize(tx, actor, "read");
        const fixedDomain = domain ? await domain({ actor: Object.freeze({ id: actor.id, sessionVersion: actor.sessionVersion }), tx }) : undefined;
        const parsed = listStateSchema.safeParse(input);
        if (!parsed.success || parsed.data.invalidFilters) throw new ModelValidationError("Revisa los filtros y parámetros de esta lista.");
        if (policy && parsed.data.sort && !(parsed.data.sort === "id" && !policy.sortable?.length) && !policy.sortable?.includes(parsed.data.sort)) throw new ModelValidationError("El orden solicitado no está habilitado.");
        if (policy && parsed.data.query && !policy.searchFields.length) throw new ModelValidationError("La búsqueda no está habilitada.");
        const state = normalizeListState(config, parsed.data);
        let grouping: ReturnType<typeof groupingPlan>;
        try { grouping = groupingPlan(config.columns, state); }
        catch (error) { throw new ModelValidationError((error as Error).message); }
        if (new Set(state.filters.map(filter => filter.field)).size !== state.filters.length) throw new ModelValidationError("Usa un filtro por columna.");
        const predicates: Record<string, unknown>[] = group ? [{ [group.field]: group.value }] : [];
        predicates.push(...grouping.predicates);
        if (fixedDomain) predicates.push(fixedDomain);
        if (scope) predicates.push(scope);
        for (const filter of state.filters) {
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
            predicates.push(filter.operator === "empty" ? { OR: field.required ? [] : [{ [filter.field]: null }] } : field.required ? {} : { [filter.field]: { not: null } });
          } else predicates.push(compileColumnFilter(type, filter, field ? !field.required : ["createBy", "createByUser.partner.name"].includes(filter.field), presentation.audit ? ["createByUser", "createByUser.partner"] : []));
        }
        if (state.query) {
          predicates.push({ OR: config.searchFields.map(field => compileColumnFilter("text", { field, operator: "contains", value: state.query })) });
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
        const rows = await resolveCollectionRelated(tx,sourceRows,config.columns.map(column=>column.field).filter(name=>Object.hasOwn(relatedFields,name)),relatedFields,repository);
        const names = await resolveDisplayNames(tx, sourceRows, model, repository);
        // Repository contracts can contain extra edit fields: collection DTOs honor the fixed server publication.
        const publishedRows = policy ? rows.map(row => projectListRow(row, [...policy.fields, ...policy.fields.flatMap(name => auditAvatarField(name) ? [auditAvatarField(name)!] : [])])) : rows;
        return { rows: publishedRows.map(row => ({ ...row, $displayName: names.get(row.id)! })), total, page, pageSize: state.pageSize };
      }, { isolationLevel: "RepeatableRead" });
      // Labels use independently authorized lookups after the list snapshot; no cross-request cache.
      // They are presentation, never predicates, ordering keys or authorization inputs.
      return presentation.relations ? resolveListLabels({ ok: true, data }, presentation.relations) : { ok: true, data };
    } catch (error) { return { ok: false, error: messageFor(error) }; }
  }

  async function kanban(prisma: PrismaClient, actor: ModelActor, input: KanbanRequest): Promise<ListResult> {
    const request = z.strictObject({ group: z.string().min(1).max(100), state: listStateSchema }).safeParse(input);
    if (!groupField || !request.success || request.data.state.groupBy?.length || request.data.state.groupPath?.length || !groups.some(group => group.value === request.data.group)) return { ok: false, error: "La columna del kanban no está habilitada." };
    return list(prisma, actor, request.data.state, { field: groupField, value: request.data.group });
  }

  async function move(prisma: PrismaClient, actor: ModelActor, input: unknown): Promise<KanbanMoveResult> {
    try {
      await prisma.$transaction(async tx => {
        const scope = await authorize(tx, actor, "write");
        const parsed = z.strictObject({ id: idSchema, revision: z.iso.datetime({ precision: 3 }), from: z.string().min(1).max(100), to: z.string().min(1).max(100) }).safeParse(input);
        if (!groupField || !parsed.success || !groups.some(group => group.value === parsed.data.from) || !groups.some(group => group.value === parsed.data.to)) throw new ModelValidationError("El movimiento no corresponde a los estados permitidos.");
        const current = await inScope(tx, parsed.data.id, scope) ? await repository.read(tx, parsed.data.id) : null;
        if (!current || current.revision !== parsed.data.revision || current[groupField] !== parsed.data.from) throw new ModelValidationError(conflict);
        if (parsed.data.from !== parsed.data.to) await persist(tx, actor, { ...current, [groupField]: parsed.data.to });
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
    const fixed = dynamic ? undefined : compileListDomain(model.metadata, source === undefined ? [] : source);
    const resolve = async (context: ListDomainContext) => dynamic ? compileListDomain(model.metadata, await dynamic(context)) : fixed!;
    return (prisma: PrismaClient, actor: ModelActor, input: unknown) => list(prisma, actor, input, undefined, resolve);
  }

  function remove(prisma: PrismaClient, actor: ModelActor, input: unknown): Promise<ListDeleteResult> {
    let scope: Record<string, unknown> | undefined;
    return deleteListSelection(prisma, actor, input, {
      // Records outside the rules read as missing: the whole batch is rejected as a conflict.
      read: async (tx, id) => await inScope(tx, id, scope) ? repository.read(tx, id) : null,
      remove: async (tx, id, revision) => {
        if (!repository.remove) throw new Error("MODEL_NOT_BOUND");
        await repository.remove(tx, id, revision);
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
        return readActivity(tx, model.name, model.metadata, parsed.data);
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
      return await prisma.$transaction(async tx => {
        const scope = await authorize(tx, actor, "read");
        if (!repository.lookup) throw new Error("MODEL_NOT_BOUND");
        const fields = displayProjectionPaths(model.metadata, model.displayFields);
        if (fields.some(field => field.includes(".") && !repository.lookupPaths?.includes(field))) throw new Error("MODEL_NOT_BOUND");
        const search = config.searchFields.filter(field => model.metadata[field]?.kind === "text" && !model.metadata[field].sensitive);
        const predicates: Record<string, unknown>[] = scope ? [scope] : [];
        if (request.id) predicates.push({ id: request.id });
        if (request.ids) predicates.push({ id: { in: request.ids } });
        for (const word of request.query.trim().split(/\s+/).filter(Boolean)) {
          predicates.push(search.length ? { OR: search.map(field => ({ [field]: { contains: word.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" } })) } : { id: { in: [] } });
        }
        const where = { AND: predicates };
        const total = await repository.count(tx, where);
        const pageSize = request.ids?.length ?? request.pageSize;
        const page = request.ids ? 1 : Math.min(request.page, Math.max(1, Math.ceil(total / pageSize)));
        const records = total ? await repository.lookup(tx, { fields, where, skip: (page - 1) * pageSize, take: pageSize }) : [];
        return { ok: true as const, total, page, pageSize, items: records.map(row => {
          if (typeof row.id !== "string") throw new Error("Invalid lookup record");
          // Only the label and ID leave this service, never the inputs used to construct it.
          const label = modelDisplayName(model, row);
          return { value: row.id, label, record: { id: row.id } };
        }) };
      }, { isolationLevel: "RepeatableRead" });
    } catch (error) { return { ok: false, error: messageFor(error) }; }
  }

  async function react(prisma:PrismaClient,actor:ModelActor,input:unknown):Promise<ReactionResult> {
    try {
      const request=z.strictObject({field:z.string().min(1).max(60),values:z.record(z.string(),z.unknown()),id:idSchema.optional(),revision:z.iso.datetime({precision:3}).optional()}).parse(input);
      if(JSON.stringify(request.values).length>16000 || !recordIdentitySchema.safeParse({id:request.id,revision:request.revision}).success) throw new ModelValidationError("El borrador no es válido.");
      if(!model.react || !model.reactionRules?.some(rule=>rule.fields.includes(request.field))) throw new ModelValidationError("La reacción no está habilitada.");
      const result=await prisma.$transaction(async tx=>{
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const scope=await authorize(tx,actor,request.id?"write":"create");
        if(request.id) {
          const current=await inScope(tx,request.id,scope)?await repository.read(tx,request.id):null;
          if(!current || current.revision!==request.revision) throw new ModelValidationError(conflict);
        }
        return model.react!(request.field,request.values,Object.freeze({tx,actor:Object.freeze({...actor}),id:request.id,
          resolveRelated: repository.related ? (field:string,id:string) => repository.related!(tx,field,id) : undefined,
        }));
      },{isolationLevel:"RepeatableRead"});
      return {ok:true,...result};
    } catch(error) {
      return {ok:false,error:error instanceof z.ZodError?"Revisa los campos necesarios para esta reacción.":messageFor(error),...(error instanceof ModelValidationError&&error.fieldErrors?{fieldErrors:error.fieldErrors}:{})};
    }
  }

  return { react, read, save, remove, activity, addNote, lookup, list: (prisma: PrismaClient, actor: ModelActor, input: unknown) => list(prisma, actor, input), defineListAction, kanban, move };
}
