"use server";

import { requireAdmin } from "@/lib/auth/access";
import { AccessError } from "@/lib/auth/policy";
import { prisma } from "@/lib/prisma";
import type { ListResult, ListState } from "@/lib/list/types";
import { myVehicles, myActiveVehicles } from "../models/record.lists";

export async function listMyVehicles(state: ListState): Promise<ListResult> {
  try {
    return await myVehicles(prisma, await requireAdmin(), state);
  } catch (error) {
    return { ok: false, error: error instanceof AccessError ? error.message : "No se pudieron listar tus vehículos." };
  }
}

export async function listMyActiveVehicles(state: ListState): Promise<ListResult> {
  try {
    return await myActiveVehicles(prisma, await requireAdmin(), state);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof AccessError ? error.message : "No se pudieron listar tus vehículos activos.",
    };
  }
}
