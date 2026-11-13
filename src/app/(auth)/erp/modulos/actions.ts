"use server";

import { requireAdmin } from "@/lib/auth/access";
import { AccessError } from "@/lib/auth/policy";
import { applications } from "@/lib/applications/registry";
import { prisma } from "@/lib/prisma";
import { cataloguePage, moduleCatalogue } from "@/lib/module-manager/service";
import type { ManagedModule } from "@/lib/module-manager/types";
import type { FormViewLoadResult } from "@/components/ui/form/FormViewLoader";
import type { ListResult } from "@/lib/list/types";
import { runModuleOperation } from "@/lib/module-manager/runner.server";
import type { OperationResult } from "@/lib/module-manager/operation.types";
import { z } from "zod";

const context = () => ({ root: process.cwd(), schema: new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "public", registered: new Set(applications.all().map(app => app.id)) });
const failure = (error: unknown) => error instanceof AccessError ? error.message : "No se pudo verificar el catálogo de módulos. Revisa la configuración del servidor e intenta nuevamente.";

export async function loadModules(state: unknown): Promise<ListResult> {
  try { const actor = await requireAdmin({ allowMaintenance: true }); return { ok: true, data: cataloguePage(await moduleCatalogue(prisma, actor, context()), state) }; }
  catch (error) { return { ok: false, error: failure(error) }; }
}

export async function readModule(id: unknown): Promise<FormViewLoadResult<ManagedModule>> {
  try {
    const actor = await requireAdmin({ allowMaintenance: true });
    if (typeof id !== "string" || id.length > 100 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) return { ok: false, error: "Módulo no disponible." };
    const record = (await moduleCatalogue(prisma, actor, context())).find(record => record.id === id);
    return record ? { ok: true, values: record } : { ok: false, error: "Módulo no disponible." };
  } catch (error) { return { ok: false, error: failure(error) }; }
}

const operationRequest = z.discriminatedUnion("command", [
  z.strictObject({ command: z.literal("review"), input: z.strictObject({ module: z.string().max(100).regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/), operation: z.enum(["install", "update", "uninstall"]), policy: z.enum(["keep", "drop"]) }) }),
  z.strictObject({ command: z.literal("status"), id: z.string().regex(/^[a-f0-9]{32}$/) }),
  z.strictObject({ command: z.literal("finish"), id: z.string().regex(/^[a-f0-9]{32}$/), maintenanceConfirmed: z.literal(true) }),
  z.strictObject({ command: z.literal("apply"), id: z.string().regex(/^[a-f0-9]{32}$/), fingerprint: z.string().regex(/^[a-f0-9]{64}$/), confirmedModule: z.string().max(100), maintenanceConfirmed: z.literal(true) }),
]);

export async function moduleOperation(input: unknown): Promise<OperationResult> {
  try {
    const actor = await requireAdmin({ allowMaintenance: true });
    return await runModuleOperation({ id: actor.id, sessionVersion: actor.sessionVersion }, operationRequest.parse(input));
  } catch (error) { return { ok: false, error: error instanceof AccessError ? error.message : "Solicitud de operación inválida o no disponible." }; }
}
