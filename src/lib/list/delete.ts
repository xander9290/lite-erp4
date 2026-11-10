import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { AccessError } from "../auth/policy";
import { ModelValidationError, type ModelActor } from "../orm/context";
import { listDeleteSelectionSchema, type ListDeleteResult, type ListDeleteTarget } from "./selection";

export type ListDeleteRepository = {
  read(tx: Prisma.TransactionClient, id: string): Promise<{ revision: string } | null>;
  remove(tx: Prisma.TransactionClient, id: string, revision: string): Promise<void>;
};
const conflict = "Uno de los registros cambió o ya no está disponible. Actualiza la lista antes de eliminar.";

/** All-or-nothing deletion. Actor/repository are fixed by the server action. */
export async function deleteListSelection(prisma: PrismaClient, actor: ModelActor, input: unknown, repository: ListDeleteRepository,
  guard?: (tx: Prisma.TransactionClient, actor: ModelActor, selection: readonly ListDeleteTarget[]) => Promise<void>): Promise<ListDeleteResult> {
  const parsed = listDeleteSelectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, kind: "validation", error: "Selecciona entre 1 y 50 registros válidos, sin repetirlos." };
  try {
    await prisma.$transaction(async tx => {
      const current = await tx.user.findUnique({ where: { id: actor.id }, select: { active: true, isAdmin: true, sessionVersion: true } });
      if (!current?.active || current.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
      if (!current.isAdmin) throw new AccessError("FORBIDDEN");
      await guard?.(tx, actor, parsed.data);
      for (const target of parsed.data) {
        const record = await repository.read(tx, target.id);
        if (!record || record.revision !== target.revision) throw new ModelValidationError(conflict);
      }
      for (const target of parsed.data) await repository.remove(tx, target.id, target.revision);
    }, { isolationLevel: "Serializable" });
    return { ok: true, deleted: parsed.data.length };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (error instanceof AccessError) return { ok: false, kind: "server", error: error.message };
    if (error instanceof ModelValidationError) return { ok: false, kind: "validation", error: error.message };
    if (["P2025", "P2034"].includes(code)) return { ok: false, kind: "validation", error: conflict };
    if (["P2003", "P2014"].includes(code)) return { ok: false, kind: "validation", error: "Hay registros relacionados que impiden eliminar la selección. No se eliminó ningún registro." };
    if (error instanceof Error && error.message === "MODEL_NOT_BOUND") return { ok: false, kind: "server", error: "El acceso de borrado aún no está generado. Completa orm:bind." };
    return { ok: false, kind: "server", error: "No se pudo confirmar la eliminación. Actualiza la lista y comprueba los registros antes de reintentar." };
  }
}
