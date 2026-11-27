import type { Prisma } from "@/generated/prisma/client";
import type { SavedRecord } from "./record";
import type { ModelEnvironment } from "./environment";
export type ModelActor = { id: string; sessionVersion: number };
/** `env` reads other registered models in this same transaction, with this actor's permissions. */
export type ModelContext<T = Record<string, unknown>> = { tx: Prisma.TransactionClient; actor: ModelActor; operation: "create" | "update"; id?: string; readonly previous: Readonly<SavedRecord<T>> | null; readonly env: ModelEnvironment };

/** Context of beforeRemove: same transaction and authenticated actor as the deletion. */
export type RemoveContext = { tx: Prisma.TransactionClient; actor: ModelActor; id: string; readonly env: ModelEnvironment };

export class ModelValidationError extends Error {
  constructor(message: string, readonly fieldErrors?: Record<string, string>) { super(message); }
}

/** Validation of ephemeral action inputs, separate from document field errors. */
export class ActionParameterError extends ModelValidationError {
  constructor(message: string, readonly parameterErrors?: Record<string, string>) { super(message); }
}
