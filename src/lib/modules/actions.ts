"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/access";
import { AccessError } from "@/lib/auth/policy";
import { prisma } from "@/lib/prisma";
import { authorizeModelEntry } from "@/lib/access/engine";
import type { FormViewLoadResult } from "@/components/ui/form/FormViewLoader";
import type { FormViewResult } from "@/components/ui/form/formView.types";
import type { ListResult } from "@/lib/list/types";
import type { ListDeleteResult } from "@/lib/list/selection";
import type { KanbanMoveResult } from "@/lib/kanban/types";
import type { ActivityNoteResult, ActivityResult } from "@/lib/orm/activity";
import type { Many2OneResult } from "@/lib/many2one/types";
import type { ReactionResult } from "@/lib/orm/reactions.types";
import type { CloudinaryImageSignatureResult } from "@/lib/uploads/cloudinary-signature";
import { childCollectionList, creatorLookup, getModuleModel, imageSigner, modelService, withActor, relationLookup, relationQuickCreate, type QuickCreateResult } from "./registry";
import { applyTransfer, exportTransfer, reviewTransfer } from "../list/transfer";
import { MAX_IMPORT_BYTES, TransferInputError } from "../list/transfer-file";
import type { TransferFile, TransferPlan, TransferResult } from "../list/transfer-types";
import { ModelValidationError } from "../orm/context";
import { parameterLookup } from "./registry";
import { selectedScreen } from "./screens";

async function requireEntry(model: string) {
  const actor = await requireUser();
  await prisma.$transaction(tx => authorizeModelEntry(tx, actor, model), { isolationLevel: "RepeatableRead" });
  return actor;
}

/*
 * Single entry point for declarative module models. Every export is a public endpoint:
 * the model id is checked against the server registry, and each service operation
 * revalidates the session inside its own transaction. Operations are fixed; the
 * browser never chooses methods, repositories, domains or fields to publish.
 */
type Values = Record<string, unknown>;
const unknownModel = "Este modelo no está disponible.";
const failure = (error: unknown, fallback: string) => error instanceof AccessError ? error.message : fallback;

function resolve(id: unknown) {
  const found = getModuleModel(id);
  if (!found) throw new Error(unknownModel);
  return { entry: found.entry, service: modelService(found.entry.id) };
}

/**
 * Domain of a declared screen of the model. The browser only names a screen id; the domain and
 * its compilation stay in the server registry, and record rules still apply on top of it.
 */
function screenSource(entry: ReturnType<typeof resolve>["entry"], screen: unknown) {
  const found = selectedScreen(entry, screen);
  if (!found) throw new Error("Esta pantalla no está disponible.");
  return { domain: found.domain };
}

export async function modelTransferReview(model: string, form: FormData): Promise<TransferResult<TransferPlan>> {
  try {
    const actor = await requireEntry(model);
    const file = form.get("file");
    if (!(file instanceof File) || file.size > MAX_IMPORT_BYTES) throw new Error("Archivo inválido.");
    const data = await reviewTransfer(prisma, actor, model, file.name, Buffer.from(await file.arrayBuffer()));
    return { ok: true, data };
  } catch (error) { return { ok: false, error: error instanceof AccessError || error instanceof ModelValidationError || error instanceof TransferInputError ? error.message : "No se pudo revisar el archivo. Comprueba formato, tamaño, encabezados y permisos." }; }
}

export async function modelTransferApply(model: string, token: string): Promise<TransferResult<{ created: number; updated: number; unchanged: number }>> {
  try {
    const data = await applyTransfer(prisma, await requireEntry(model), model, token);
    const { entry } = resolve(model);
    revalidatePath(entry.route);
    return { ok: true, data };
  } catch (error) { return { ok: false, error: error instanceof AccessError || error instanceof ModelValidationError ? error.message : "No se pudo aplicar el plan. Vuelve a revisar el archivo antes de intentar otra vez." }; }
}

export async function modelTransferExport(model: string, input: unknown): Promise<TransferResult<TransferFile>> {
  try { return { ok: true, data: await exportTransfer(prisma, await requireEntry(model), model, input) }; }
  catch (error) { return { ok: false, error: error instanceof AccessError || error instanceof ModelValidationError ? error.message : "No se pudo generar el archivo. Revisa los filtros y permisos." }; }
}

export async function modelRead(model: string, id: unknown): Promise<FormViewLoadResult<Values>> {
  try { const { service } = resolve(model); return await service.read(prisma, await requireEntry(model), id); }
  catch (error) { return { ok: false, error: failure(error, unknownModel) }; }
}

/** Run a business action published with `@action`; the service validates the name against the model's whitelist. */
export async function modelAction(model: string, input: unknown): Promise<FormViewResult<Values>> {
  try {
    const { entry, service } = resolve(model);
    const result = await service.action(prisma, await requireEntry(model), input);
    if (result.ok) revalidatePath(entry.route);
    return result;
  } catch (error) { return { ok: false, kind: "server", error: failure(error, "No se pudo ejecutar la acción.") }; }
}

export async function modelSave(model: string, input: unknown): Promise<FormViewResult<Values>> {
  try {
    const { entry, service } = resolve(model);
    const result = await service.save(prisma, await requireEntry(model), input);
    if (result.ok) revalidatePath(entry.route);
    return result;
  } catch (error) { return { ok: false, kind: "server", error: failure(error, "No se pudo guardar el registro.") }; }
}

/** Read-only relation of a form: children of one parent record (fixed server domain). */
export async function modelChildren(model: string, field: string, parentId: unknown, state: unknown): Promise<ListResult> {
  try { const { entry } = resolve(model); return await childCollectionList(entry.id, field, parentId, await requireEntry(model), state); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo consultar la relación.") }; }
}

export async function modelList(model: string, state: unknown, screen?: unknown): Promise<ListResult> {
  try { const { entry, service } = resolve(model); const source = screenSource(entry, screen); const actor = await requireEntry(model); return await withActor(actor, () => service.list(prisma, actor, state, source)); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo consultar la lista.") }; }
}

export async function modelDelete(model: string, selection: unknown): Promise<ListDeleteResult> {
  try {
    const { entry, service } = resolve(model);
    const result = await service.remove(prisma, await requireEntry(model), selection);
    if (result.ok) revalidatePath(entry.route, "layout");
    return result;
  } catch (error) { return { ok: false, kind: "server", error: failure(error, "No se pudo eliminar la selección.") }; }
}

export async function modelLookup(model: string, request: unknown): Promise<Many2OneResult> {
  try { const { service } = resolve(model); return await service.lookup(prisma, await requireEntry(model), request); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo consultar los registros.") }; }
}

/** «Crear "texto"» of a Many2many with `create: true` (target fixed by the server). */
export async function modelQuickCreate(model: string, field: string, text: unknown): Promise<QuickCreateResult> {
  try { const { entry } = resolve(model); return await relationQuickCreate(entry.id, field, await requireEntry(model), text); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo crear el registro.") }; }
}

export async function modelRelationLookup(model: string, field: string, input: unknown): Promise<Many2OneResult> {
  try { return await relationLookup(model, field, await requireEntry(model), input); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo consultar la relación.") }; }
}

export async function modelParameterLookup(model: string, action: string, parameter: string, input: unknown): Promise<Many2OneResult> {
  try { return await parameterLookup(model, action, parameter, await requireEntry(model), input); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo consultar el parámetro.") }; }
}

/** «Creado por» filter: creators of readable records of this model (id and contact name). */
export async function modelCreators(model: string, request: unknown): Promise<Many2OneResult> {
  try { const { entry } = resolve(model); return await creatorLookup(entry.id, await requireEntry(model), request); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo consultar los creadores.") }; }
}

export async function modelKanban(model: string, request: unknown, screen?: unknown): Promise<ListResult> {
  try { const { entry, service } = resolve(model); const source = screenSource(entry, screen); const actor = await requireEntry(model); return await withActor(actor, () => service.kanban(prisma, actor, request as never, source)); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo consultar el tablero.") }; }
}

export async function modelMove(model: string, input: unknown): Promise<KanbanMoveResult> {
  try {
    const { entry, service } = resolve(model);
    const result = await service.move(prisma, await requireEntry(model), input);
    if (result.ok) revalidatePath(entry.route);
    return result;
  } catch (error) { return { ok: false, kind: "server", error: failure(error, "No se pudo guardar el movimiento.") }; }
}

export async function modelReact(model: string, input: unknown): Promise<ReactionResult> {
  try { const { service } = resolve(model); return await service.react(prisma, await requireEntry(model), input); }
  catch { return { ok: false, error: "No se pudo completar la reacción." }; }
}

export async function modelActivity(model: string, request: unknown): Promise<ActivityResult> {
  try { const { service } = resolve(model); return await service.activity(prisma, await requireEntry(model), request); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo consultar la actividad.") }; }
}

export async function modelNote(model: string, request: unknown): Promise<ActivityNoteResult> {
  try { const { service } = resolve(model); return await service.addNote(prisma, await requireEntry(model), request); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo publicar la nota.") }; }
}

export async function modelSignImage(model: string, field: unknown): Promise<CloudinaryImageSignatureResult> {
  try { resolve(model); await requireEntry(model); return await imageSigner(model)(field as string); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo preparar la subida.") }; }
}
