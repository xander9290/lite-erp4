import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { AccessError } from "../auth/policy";
import type { ModelActor } from "./context";

type Query = (prisma: PrismaClient, actor: ModelActor, input: never) => Promise<{ ok: boolean }>;
type QueryFailure = { ok: false; error: string };
type Actions<Q extends Record<string, Query>> = {
  [K in keyof Q]: (input: Parameters<Q[K]>[2]) => Promise<Awaited<ReturnType<Q[K]>> | QueryFailure>;
};

/** Server-fixed queries only. Keep explicit async exports in the use-server module. */
export function createQueryActions<Q extends Record<string, Query>>(
  context: { prisma: PrismaClient; authorize: () => Promise<ModelActor>; error?: string },
  queries: Q,
): Actions<Q> {
  return Object.fromEntries(Object.entries(queries).map(([name, query]) => [name, async (input: never) => {
    try { return await query(context.prisma, await context.authorize(), input); }
    catch (error) { return { ok: false as const, error: error instanceof AccessError ? error.message : context.error ?? "No se pudo completar la consulta." }; }
  }])) as Actions<Q>;
}
