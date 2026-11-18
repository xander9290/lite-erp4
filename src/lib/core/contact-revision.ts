import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { nextRevision } from "../orm/revision";

/** Invalidate an open delegated User form when its contact is edited elsewhere. */
export async function advanceContactUserRevision(tx: Prisma.TransactionClient, partnerId: string, revision: Date) {
  const user = await tx.user.findUnique({ where: { partnerId }, select: { id: true, updatedAt: true } });
  if (!user) return;
  await tx.user.update({ where: { id: user.id, updatedAt: user.updatedAt }, data: { updatedAt: nextRevision(user.updatedAt, revision) }, select: { id: true } });
}
