import "server-only";
import type { ModelActor } from "../orm/context";
import { AccessError } from "../auth/policy";
import { prisma } from "../prisma";
import { authorizeModelEntry, readAccessCapabilities } from "../access/engine";
import { modelClientConfig, modelService, relationLookup } from "./registry";
import { FormOpenError, prepareFormOpen } from "./form-open";

/** Shared by the authenticated endpoint and disposable-schema integration tests. No writes. */
export async function prepareRegisteredFormOpen(input: unknown, actor: ModelActor) {
  const authorize = async (model: string, id?: string) => {
    const access = await prisma.$transaction(async tx => {
      await authorizeModelEntry(tx, actor, model);
      return readAccessCapabilities(tx, actor);
    }, { isolationLevel: "RepeatableRead" });
    if (!access.modelAccess[model]?.read || (!id && !access.modelAccess[model]?.create)) throw new AccessError("DENIED");
    if (id) {
      const result = await modelService(model).read(prisma, actor, id);
      if (!result.ok) throw new FormOpenError("El registro no está disponible.");
    }
    return modelClientConfig(model, access);
  };
  return prepareFormOpen(input, {
    authorize,
    readOrigin: async (model, id) => { await authorize(model, id); },
    lookup: (model, field, draft, id) => relationLookup(model, field, actor, { request: { id }, draft }),
  });
}
