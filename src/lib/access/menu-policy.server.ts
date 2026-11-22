import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { HiddenMenu } from "./menu-policy";

/** Navigation snapshot only; model CRUD/field checks do not need menu policies. */
export async function loadHiddenMenus(tx: Prisma.TransactionClient, groups: ReadonlySet<string>): Promise<HiddenMenu[]> {
  return groups.size ? tx.accessMenuHidden.findMany({ where: { groupId: { in: [...groups] } }, select: { application: true, menu: true } }) : [];
}
