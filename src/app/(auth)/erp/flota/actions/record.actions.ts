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
