import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { HiddenPage } from "../modules/pages";

/**
 * Presentation snapshot of the effective groups (implied groups included). Like field policies,
 * a group only configures models of its own module; rows of other modules are ignored.
 * No groups (administrator bypass) needs no query.
 */
export async function loadHiddenPages(tx: Prisma.TransactionClient, groups: ReadonlySet<string>): Promise<HiddenPage[]> {
  if (!groups.size) return [];
  const rows = await tx.accessPageHidden.findMany({ where: { groupId: { in: [...groups] } }, select: { groupId: true, model: true, screen: true, layout: true, notebook: true, page: true } });
  return rows.filter(row => row.groupId.split(".")[0] === row.model.split(".")[0]).map(({ groupId: _groupId, ...page }) => { void _groupId; return page; });
}
