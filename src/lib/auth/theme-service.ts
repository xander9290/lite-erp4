import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { AccessError } from "./policy";

type Actor = { id: string; sessionVersion: number };

/** Only the current account's boolean preference can be changed. */
export async function saveOwnTheme(prisma: PrismaClient, actor: Actor, darkMode: unknown) {
  if (typeof darkMode !== "boolean") throw new Error("Selecciona un modo de apariencia válido.");
  const user = await prisma.user.findUnique({
    where: { id: actor.id }, select: { active: true, sessionVersion: true, updatedAt: true },
  });
  if (!user?.active || user.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
  const updated = await prisma.user.updateMany({
    where: { id: actor.id, active: true, sessionVersion: actor.sessionVersion, updatedAt: user.updatedAt },
    // Appearance does not invalidate the revision of an open User/Profile form.
    data: { darkMode, updatedAt: user.updatedAt },
  });
  if (updated.count !== 1) throw new Error("Tu cuenta cambió durante el guardado. Intenta nuevamente.");
  return darkMode;
}
