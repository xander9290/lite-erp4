import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ModelActor } from "../orm/context";
import { ModelValidationError } from "../orm/context";
import { deleteListSelection, type ListDeleteRepository } from "./delete";
import type { ListModel } from "./types";

// Explicit delegates only. Deleting a User preserves its shared Partner contact.
const repositories = {
  partner: {
    async read(tx, id) { const row = await tx.partner.findUnique({ where: { id }, select: { updatedAt: true } }); return row ? { revision: row.updatedAt.toISOString() } : null; },
    async remove(tx, id, revision) { await tx.partner.delete({ where: { id, updatedAt: new Date(revision) }, select: { id: true } }); },
  },
  user: {
    async read(tx, id) { const row = await tx.user.findUnique({ where: { id }, select: { updatedAt: true } }); return row ? { revision: row.updatedAt.toISOString() } : null; },
    async remove(tx, id, revision) { await tx.user.delete({ where: { id, updatedAt: new Date(revision) }, select: { id: true } }); },
  },
} satisfies Record<ListModel, ListDeleteRepository>;

export function deleteRegisteredRecords(prisma: PrismaClient, actor: ModelActor, model: ListModel, input: unknown) {
  return deleteListSelection(prisma, actor, input, repositories[model], async (tx, actor, selection) => {
    if (model === "user" && selection.some(target => target.id === actor.id)) throw new ModelValidationError("No puedes eliminar la cuenta con la que iniciaste sesión.");
  });
}
