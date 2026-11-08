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
import { recordIdentitySchema, type RecordIdentity } from "./record";
import { ModelValidationError, type ModelActor, type ModelContext } from "./context";
import type { ModelRepository } from "./repository";
import { INTEGER_MIN, INTEGER_MAX, type FieldMetadata } from "./fields";
import type { KanbanMoveResult, KanbanRequest } from "../kanban/types";
import { auditAvatarField, auditColumnType } from "./audit";

const conflict = "El registro cambió desde que lo abriste. Recarga sus datos antes de guardar.";
type Contract<T extends Record<string, unknown>> = {
  name: string; schema: z.ZodType<T>; metadata: Readonly<Record<string, FieldMetadata>>;
  beforeSave?(values: T, context: ModelContext): Promise<T>;
  afterSave?(record: Record<string, unknown>, context: ModelContext): Promise<void>;
};
const idSchema = z.string().trim().min(1).max(100);
const codeOf = (error: unknown) => error && typeof error === "object" && "code" in error ? String(error.code) : "";
export const fieldListType = (field: FieldMetadata): ListDataType => field.kind === "integer" ? "integer" : field.kind === "boolean" ? "boolean" : field.kind === "datetime" ? "datetime" : "text";

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

/** Admin-only baseline. The repository and list policy are fixed on the server, never selected by a client. */
export function createModelService<T extends Record<string, unknown>>(model: Contract<T>, repository: ModelRepository<T>, presentation: { columns: readonly ListColumn[]; searchFields: readonly string[]; defaultSort?: ListViewConfig["defaultSort"]; kanban?: { field: string }; audit?: boolean }) {
  type Values = T & RecordIdentity;
  const config: ListViewConfig = { ...presentation, model: model.name };
  const allowed = new Set(["id", ...Object.keys(model.metadata)]);
  if (presentation.audit) for (const field of ["createdAt", "updatedAt", "createBy", "createByUser.login", "createByUser.partner.name"]) allowed.add(field);
  const columnType = (field: string) => model.metadata[field] ? fieldListType(model.metadata[field]) : presentation.audit ? auditColumnType(field) ?? "text" : "text";
  if (!config.columns.length || config.columns.length > 12 || new Set(config.columns.map(column => column.field)).size !== config.columns.length || config.columns.some(column => {
    const avatar = presentation.audit && auditAvatarField(column.field);
    return !allowed.has(column.field) || (column.widget && !(column.widget === "partner" && avatar && (!column.avatarField || column.avatarField === avatar) && (!column.format || column.format === "text"))) || (column.avatarField !== undefined && (!column.widget || column.avatarField !== avatar)) || (column.type && column.type !== columnType(column.field));
  }) || config.searchFields.length > 6 || config.searchFields.some(name => name !== "id" && model.metadata[name]?.kind !== "text" && model.metadata[name]?.kind !== "many2one" && !(presentation.audit && ["createByUser.login", "createByUser.partner.name"].includes(name)))) throw new Error("La lista sólo puede publicar campos declarados o auditoría habilitada y búsquedas de texto permitidas.");
  // Normalize date types for server filters even when the view omitted an explicit type.
  config.columns = config.columns.map(column => ({ ...column, type: columnType(column.field), ...(column.widget === "partner" && auditAvatarField(column.field) ? { avatarField: auditAvatarField(column.field)! } : {}) }));
  async function readAudit(tx: Prisma.TransactionClient, id: string) {
    if (!presentation.audit) return {};
    if (!repository.audit) throw new Error("MODEL_NOT_BOUND");
    const audit = await repository.audit(tx, id);
    if (!audit) throw new ModelValidationError("El registro ya no está disponible.");
    return { audit };
  }
  if (config.defaultSort && !config.columns.some(column => column.field === config.defaultSort?.field && column.sortable)) throw new Error("El orden predeterminado debe apuntar a una columna ordenable de la lista.");
  const groupField = presentation.kanban?.field;
  const groupMetadata = groupField && Object.hasOwn(model.metadata, groupField) ? model.metadata[groupField] : null;
  if (groupField && (groupMetadata?.kind !== "selection" || !groupMetadata.required || groupMetadata.choices.length > 12)) throw new Error("El kanban inicial requiere una selección obligatoria con un máximo de 12 estados.");
  const groups = groupMetadata?.kind === "selection" ? groupMetadata.choices : [];

  async function read(prisma: PrismaClient, actor: ModelActor, input: unknown): Promise<FormViewLoadResult<Values>> {
    try {
      const record = await prisma.$transaction(async tx => {
        await assertActor(tx, actor);
        const id = idSchema.safeParse(input);
        if (!id.success) throw new ModelValidationError("El registro no es válido.");
        const values = await repository.read(tx, id.data);
        return values ? { values, ...await readAudit(tx, id.data) } : null;
      }, { isolationLevel: "RepeatableRead" });
      return record ? { ok: true, ...record } : { ok: false, error: "No se encontró este registro." };
    } catch (error) { return { ok: false, kind: error instanceof ModelValidationError ? "validation" : "server", error: messageFor(error) }; }
  }

  async function persist(tx: Prisma.TransactionClient, actor: ModelActor, input: unknown) {
    await assertActor(tx, actor);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new ModelValidationError("Revisa los datos del registro.");
    const { id, revision, ...fields } = input as Record<string, unknown>;
    const identity = recordIdentitySchema.safeParse({ id, revision });
    const parsed = model.schema.safeParse(fields);
    if (!identity.success || !parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of [...(!identity.success ? identity.error.issues : []), ...(!parsed.success ? parsed.error.issues : [])]) if (issue.path.length) errors[issue.path.join(".")] ??= issue.message;
      throw new ModelValidationError("Revisa los datos del registro.", errors);
    }
    const metadata = identity.data;
    if (metadata.id) {
      const current = await repository.read(tx, metadata.id);
      if (!current || current.revision !== metadata.revision) throw new ModelValidationError(conflict);
    }
    const context: ModelContext = { tx, actor, operation: metadata.id ? "update" : "create", id: metadata.id };
    const values = model.schema.parse(model.beforeSave ? await model.beforeSave(parsed.data, context) : parsed.data);
    const saved = metadata.id ? await repository.update(tx, metadata.id, metadata.revision!, values) : await repository.create(tx, values, actor.id);
    await model.afterSave?.(saved, context);
    const final = await repository.read(tx, saved.id);
    if (!final) throw new ModelValidationError("El registro no está disponible después de guardar.");
    return final;
  }

  async function save(prisma: PrismaClient, actor: ModelActor, input: unknown): Promise<FormViewResult<Values>> {
    try {
      const record = await prisma.$transaction(async tx => {
        const values = await persist(tx, actor, input);
        return { values, ...await readAudit(tx, values.id) };
      }, { isolationLevel: "Serializable" });
      return { ok: true, ...record, message: "Registro guardado." };
    } catch (error) {
      const validation = error instanceof ModelValidationError || error instanceof z.ZodError || ["P2002", "P2003", "P2018", "P2025", "P2034"].includes(codeOf(error));
      const fieldErrors = error instanceof ModelValidationError ? error.fieldErrors : error instanceof z.ZodError ? Object.fromEntries(error.issues.filter(issue => issue.path.length).map(issue => [issue.path.join("."), issue.message])) : undefined;
      return { ok: false, kind: validation ? "validation" : "server", error: error instanceof z.ZodError ? "Revisa los datos del registro." : messageFor(error), ...(fieldErrors ? { fieldErrors: fieldErrors as Partial<Record<FieldPath<Values>, string>> } : {}) };
    }
  }

  async function list(prisma: PrismaClient, actor: ModelActor, input: unknown, group?: { field: string; value: string }): Promise<ListResult> {
    try {
      const data = await prisma.$transaction(async tx => {
        await assertActor(tx, actor);
        const parsed = listStateSchema.safeParse(input);
        if (!parsed.success || parsed.data.invalidFilters) throw new ModelValidationError("Revisa los filtros y parámetros de esta lista.");
        const state = normalizeListState(config, parsed.data);
        if (new Set(state.filters.map(filter => filter.field)).size !== state.filters.length) throw new ModelValidationError("Usa un filtro por columna.");
        const predicates: Record<string, unknown>[] = group ? [{ [group.field]: group.value }] : [];
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
        const page = Math.min(state.page, Math.max(1, Math.ceil(total / state.pageSize)));
        const rows = await repository.list(tx, { where, sort: state.sort, direction: state.direction, skip: (page - 1) * state.pageSize, take: state.pageSize, audit: presentation.audit === true });
        return { rows, total, page, pageSize: state.pageSize };
      }, { isolationLevel: "RepeatableRead" });
      return { ok: true, data };
    } catch (error) { return { ok: false, error: messageFor(error) }; }
  }

  async function kanban(prisma: PrismaClient, actor: ModelActor, input: KanbanRequest): Promise<ListResult> {
    const request = z.strictObject({ group: z.string().min(1).max(100), state: listStateSchema }).safeParse(input);
    if (!groupField || !request.success || !groups.some(group => group.value === request.data.group)) return { ok: false, error: "La columna del kanban no está habilitada." };
    return list(prisma, actor, request.data.state, { field: groupField, value: request.data.group });
  }

  async function move(prisma: PrismaClient, actor: ModelActor, input: unknown): Promise<KanbanMoveResult> {
    try {
      await prisma.$transaction(async tx => {
        await assertActor(tx, actor);
        const parsed = z.strictObject({ id: idSchema, revision: z.iso.datetime({ precision: 3 }), from: z.string().min(1).max(100), to: z.string().min(1).max(100) }).safeParse(input);
        if (!groupField || !parsed.success || !groups.some(group => group.value === parsed.data.from) || !groups.some(group => group.value === parsed.data.to)) throw new ModelValidationError("El movimiento no corresponde a los estados permitidos.");
        const current = await repository.read(tx, parsed.data.id);
        if (!current || current.revision !== parsed.data.revision || current[groupField] !== parsed.data.from) throw new ModelValidationError(conflict);
        if (parsed.data.from !== parsed.data.to) await persist(tx, actor, { ...current, [groupField]: parsed.data.to });
      }, { isolationLevel: "Serializable" });
      return { ok: true };
    } catch (error) { return { ok: false, kind: error instanceof ModelValidationError || error instanceof z.ZodError || ["P2002", "P2003", "P2025", "P2034"].includes(codeOf(error)) ? "validation" : "server", error: messageFor(error) }; }
  }

  return { read, save, list: (prisma: PrismaClient, actor: ModelActor, input: unknown) => list(prisma, actor, input), kanban, move };
}
