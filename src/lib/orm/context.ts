import type { Prisma } from "@/generated/prisma/client";
import type { SavedRecord } from "./record";
export type ModelActor = { id: string; sessionVersion: number };
export type ModelContext<T = Record<string, unknown>> = { tx: Prisma.TransactionClient; actor: ModelActor; operation: "create" | "update"; id?: string; readonly previous: Readonly<SavedRecord<T>> | null };

export class ModelValidationError extends Error {
  constructor(message: string, readonly fieldErrors?: Record<string, string>) { super(message); }
}
