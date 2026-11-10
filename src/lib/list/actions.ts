"use server";

import { listConfigSchema, listStateSchema } from "./query";
import { normalizeListState } from "./state";
import { listRegistry } from "./registry";
import type { ListConfig, ListResult, ListState } from "./types";
import { validateListFilters } from "./filters";
import { requireAdmin, requireUser } from "../auth/access";
import { AccessError } from "../auth/policy";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "../prisma";
import { deleteRegisteredRecords } from "./delete-registry";
import type { ListDeleteResult, ListDeleteTarget } from "./selection";

export async function listRecords(config: ListConfig, state: ListState): Promise<ListResult> {
  let actor: Awaited<ReturnType<typeof requireUser>>;
  try { actor = await requireUser(); if (config?.model === "user" || config?.model === "dentalAppointment") await requireAdmin(); }
  catch (error) { return { ok: false, error: error instanceof AccessError ? error.message : "No se pudo verificar tu sesión." }; }
  const parsedConfig = listConfigSchema.safeParse(config);
  const parsedState = listStateSchema.safeParse(state);
  if (!parsedConfig.success || !parsedState.success) return { ok: false, error: "Revisa la configuración y los parámetros de esta lista." };
  if (parsedState.data.invalidFilters) return { ok: false, error: "El enlace contiene filtros inválidos. Limpia los filtros para continuar." };
  const filterError = validateListFilters(parsedConfig.data, parsedState.data.filters);
  if (filterError) return { ok: false, error: filterError };
  try {
    const query = normalizeListState(parsedConfig.data, parsedState.data);
    return { ok: true, data: await listRegistry[parsedConfig.data.model](parsedConfig.data, query, actor) };
  } catch {
    return { ok: false, error: "No pudimos cargar los registros. Revisa tu conexión e intenta nuevamente." };
  }
}

export async function deleteRecords(model: ListConfig["model"], selection: readonly ListDeleteTarget[]): Promise<ListDeleteResult> {
  const parsed = z.enum(["partner", "user", "dentalAppointment"]).safeParse(model);
  if (!parsed.success) return { ok: false, kind: "validation", error: "Esta lista no permite eliminar registros." };
  try {
    const result = await deleteRegisteredRecords(prisma, await requireAdmin(), parsed.data, selection);
    if (result.ok) revalidatePath("/erp", "layout");
    return result;
  } catch (error) { return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo eliminar la selección." }; }
}
