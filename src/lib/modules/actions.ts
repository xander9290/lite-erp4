"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/access";
import { AccessError } from "@/lib/auth/policy";
import { prisma } from "@/lib/prisma";
import type { FormViewLoadResult } from "@/components/ui/form/FormViewLoader";
import type { FormViewResult } from "@/components/ui/form/formView.types";
import type { ListResult } from "@/lib/list/types";
import type { ListDeleteResult } from "@/lib/list/selection";
import type { KanbanMoveResult } from "@/lib/kanban/types";
import type { ActivityNoteResult, ActivityResult } from "@/lib/orm/activity";
import type { Many2OneResult } from "@/lib/many2one/types";
import type { ReactionResult } from "@/lib/orm/reactions.types";
import type { CloudinaryImageSignatureResult } from "@/lib/uploads/cloudinary-signature";
import { getModuleModel, imageSigner, modelService, withActor } from "./registry";

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

export async function modelRead(model: string, id: unknown): Promise<FormViewLoadResult<Values>> {
  try { const { service } = resolve(model); return await service.read(prisma, await requireUser(), id); }
  catch (error) { return { ok: false, error: failure(error, unknownModel) }; }
}

export async function modelSave(model: string, input: unknown): Promise<FormViewResult<Values>> {
  try {
    const { entry, service } = resolve(model);
    const result = await service.save(prisma, await requireUser(), input);
    if (result.ok) revalidatePath(entry.route);
    return result;
  } catch (error) { return { ok: false, kind: "server", error: failure(error, "No se pudo guardar el registro.") }; }
}

export async function modelList(model: string, state: unknown): Promise<ListResult> {
  try { const { service } = resolve(model); const actor = await requireUser(); return await withActor(actor, () => service.list(prisma, actor, state)); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo consultar la lista.") }; }
}

export async function modelDelete(model: string, selection: unknown): Promise<ListDeleteResult> {
  try {
    const { entry, service } = resolve(model);
    const result = await service.remove(prisma, await requireUser(), selection);
    if (result.ok) revalidatePath(entry.route, "layout");
    return result;
  } catch (error) { return { ok: false, kind: "server", error: failure(error, "No se pudo eliminar la selección.") }; }
}

export async function modelLookup(model: string, request: unknown): Promise<Many2OneResult> {
  try { const { service } = resolve(model); return await service.lookup(prisma, await requireUser(), request); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo consultar los registros.") }; }
}

export async function modelKanban(model: string, request: unknown): Promise<ListResult> {
  try { const { service } = resolve(model); const actor = await requireUser(); return await withActor(actor, () => service.kanban(prisma, actor, request as never)); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo consultar el tablero.") }; }
}

export async function modelMove(model: string, input: unknown): Promise<KanbanMoveResult> {
  try {
    const { entry, service } = resolve(model);
    const result = await service.move(prisma, await requireUser(), input);
    if (result.ok) revalidatePath(entry.route);
    return result;
  } catch (error) { return { ok: false, kind: "server", error: failure(error, "No se pudo guardar el movimiento.") }; }
}

export async function modelReact(model: string, input: unknown): Promise<ReactionResult> {
  try { const { service } = resolve(model); return await service.react(prisma, await requireUser(), input); }
  catch { return { ok: false, error: "No se pudo completar la reacción." }; }
}

export async function modelActivity(model: string, request: unknown): Promise<ActivityResult> {
  try { const { service } = resolve(model); return await service.activity(prisma, await requireUser(), request); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo consultar la actividad.") }; }
}

export async function modelNote(model: string, request: unknown): Promise<ActivityNoteResult> {
  try { const { service } = resolve(model); return await service.addNote(prisma, await requireUser(), request); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo publicar la nota.") }; }
}

export async function modelSignImage(model: string, field: unknown): Promise<CloudinaryImageSignatureResult> {
  try { resolve(model); return await imageSigner(model)(field as string); }
  catch (error) { return { ok: false, error: failure(error, "No se pudo preparar la subida.") }; }
}
