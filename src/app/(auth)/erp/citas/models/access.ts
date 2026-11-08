import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { AccessError } from "@/lib/auth/policy";

export type ClinicalActor = { id: string; sessionVersion: number };

/** Identity comes from the server session; permissions are rechecked in each transaction. */
export async function assertClinicalActor(tx: Prisma.TransactionClient, actor: ClinicalActor) {
  const account = await tx.user.findUnique({ where: { id: actor.id }, select: { active: true, isAdmin: true, sessionVersion: true } });
  if (!account?.active || account.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
  if (!account.isAdmin) throw new AccessError("FORBIDDEN");
}
