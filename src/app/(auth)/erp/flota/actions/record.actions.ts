"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
import { AccessError } from "@/lib/auth/policy";
import { prisma } from "@/lib/prisma";
import type { FormViewLoadResult } from "@/components/ui/form/FormViewLoader";
import type { FormViewResult } from "@/components/ui/form/formView.types";
import type { ListResult, ListState } from "@/lib/list/types";
import type { RecordInput } from "../schemas/record.schema";
import { recordService } from "../models/record.service";
import type { ListDeleteResult, ListDeleteTarget } from "@/lib/list/selection";
import type { ActivityRequest, ActivityResult, ActivityNote, ActivityNoteResult } from "@/lib/orm/activity";

export async function loadActivity(request: ActivityRequest): Promise<ActivityResult> {
  try { return await recordService.activity(prisma, await requireAdmin(), request); }
  catch (error) { return { ok: false, error: error instanceof AccessError ? error.message : "No se pudo cargar la actividad." }; }
}

export async function addNote(request: ActivityNote): Promise<ActivityNoteResult> {
  try { return await recordService.addNote(prisma, await requireAdmin(), request); }
  catch (error) { return { ok: false, error: error instanceof AccessError ? error.message : "No se pudo publicar la nota." }; }
}

export async function readRecord(id: string): Promise<FormViewLoadResult<RecordInput>> {
  try { return await recordService.read(prisma, await requireAdmin(), id); }
  catch (error) { return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo abrir el registro." }; }
}

export async function saveRecord(input: unknown): Promise<FormViewResult<RecordInput>> {
  try {
    const result = await recordService.save(prisma, await requireAdmin(), input);
    if (result.ok) revalidatePath("/erp/flota");
    return result;
  } catch (error) { return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo guardar el registro." }; }
}

export async function listRecords(state: ListState): Promise<ListResult> {
  try { return await recordService.list(prisma, await requireAdmin(), state); }
  catch (error) { return { ok: false, error: error instanceof AccessError ? error.message : "No se pudieron listar los registros." }; }
}

export async function deleteRecords(selection: readonly ListDeleteTarget[]): Promise<ListDeleteResult> {
  try {
    const result = await recordService.remove(prisma, await requireAdmin(), selection);
    if (result.ok) revalidatePath("/erp/flota", "layout");
    return result;
  } catch (error) { return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo eliminar la selección." }; }
}

// Enable a required Selection field in recordService's kanban configuration before using this view.
export async function loadKanban(request: import("@/lib/kanban/types").KanbanRequest): Promise<ListResult> {
  try { return await recordService.kanban(prisma, await requireAdmin(), request); }
  catch (error) { return { ok: false, error: error instanceof AccessError ? error.message : "No se pudo cargar el tablero." }; }
}

export async function moveRecord(input: import("@/lib/kanban/types").KanbanMove): Promise<import("@/lib/kanban/types").KanbanMoveResult> {
  try {
    const result = await recordService.move(prisma, await requireAdmin(), input);
    if (result.ok) revalidatePath("/erp/flota");
    return result;
  } catch (error) { return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo guardar el movimiento." }; }
}

export async function onchangeRecord(input:import("@/lib/orm/reactions.types").ReactionRequest):Promise<import("@/lib/orm/reactions.types").ReactionResult> {
  try {return await recordService.react(prisma,await requireAdmin(),input);}
  catch {return {ok:false,error:"No se pudo completar la reacción."};}
}
