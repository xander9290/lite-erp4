"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/access";
import { AccessError } from "@/lib/auth/policy";
import { prisma } from "@/lib/prisma";
import type { FormViewLoadResult } from "@/components/ui/form/FormViewLoader";
import type { FormViewResult } from "@/components/ui/form/formView.types";
import type { ListResult, ListState } from "@/lib/list/types";
import type { ListDeleteResult, ListDeleteTarget } from "@/lib/list/selection";
import type { RecordInput } from "../schemas/fabricante.schema";
import { recordService } from "../models/fabricante.service";

import { createQueryActions } from "@/lib/orm/query-actions";

import { signImageUpload } from "@/generated/orm/uploads/flota/FlotaFabricante.images.actions";

const queries = createQueryActions(
  { prisma, authorize: requireAdmin },
  {
    readRecord: recordService.read,
    listRecords: recordService.list,
    loadKanban: recordService.kanban,
    loadActivity: recordService.activity,
    lookupRecords: recordService.lookup,
  },
);

export async function readRecord(
  id: string,
): Promise<FormViewLoadResult<RecordInput>> {
  return queries.readRecord(id);
}

export async function saveRecord(
  input: unknown,
): Promise<FormViewResult<RecordInput>> {
  try {
    const result = await recordService.save(
      prisma,
      await requireAdmin(),
      input,
    );
    if (result.ok) revalidatePath("/erp/flota/fabricante");
    return result;
  } catch (error) {
    return {
      ok: false,
      kind: "server",
      error:
        error instanceof AccessError
          ? error.message
          : "No se pudo guardar el registro.",
    };
  }
}

export async function listRecords(state: ListState): Promise<ListResult> {
  return queries.listRecords(state);
}

export async function deleteRecords(
  selection: readonly ListDeleteTarget[],
): Promise<ListDeleteResult> {
  try {
    const result = await recordService.remove(
      prisma,
      await requireAdmin(),
      selection,
    );
    if (result.ok) revalidatePath("/erp/flota/fabricante", "layout");
    return result;
  } catch (error) {
    return {
      ok: false,
      kind: "server",
      error:
        error instanceof AccessError
          ? error.message
          : "No se pudo eliminar la selección.",
    };
  }
}

// Enable a required Selection field in recordService's kanban configuration before using this view.
export async function loadKanban(
  request: import("@/lib/kanban/types").KanbanRequest,
): Promise<ListResult> {
  return queries.loadKanban(request);
}

export async function moveRecord(
  input: import("@/lib/kanban/types").KanbanMove,
): Promise<import("@/lib/kanban/types").KanbanMoveResult> {
  try {
    const result = await recordService.move(
      prisma,
      await requireAdmin(),
      input,
    );
    if (result.ok) revalidatePath("/erp/flota/fabricante");
    return result;
  } catch (error) {
    return {
      ok: false,
      kind: "server",
      error:
        error instanceof AccessError
          ? error.message
          : "No se pudo guardar el movimiento.",
    };
  }
}

import type {
  ActivityRequest,
  ActivityResult,
  ActivityNote,
  ActivityNoteResult,
} from "@/lib/orm/activity";

export async function loadActivity(
  request: ActivityRequest,
): Promise<ActivityResult> {
  return queries.loadActivity(request);
}

export async function addNote(
  request: ActivityNote,
): Promise<ActivityNoteResult> {
  try {
    return await recordService.addNote(prisma, await requireAdmin(), request);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof AccessError
          ? error.message
          : "No se pudo publicar la nota.",
    };
  }
}

import type { ModelLookupRequest } from "@/lib/many2one/model-lookup";
import type { Many2OneResult } from "@/lib/many2one/types";

export async function lookupRecords(
  request: ModelLookupRequest,
): Promise<Many2OneResult> {
  return queries.lookupRecords(request);
}

export async function signAvatarUpload() {
  return signImageUpload("avatar");
}
