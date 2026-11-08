import type { Prisma } from "@/generated/prisma/client";
export type ModelActor = { id: string; sessionVersion: number };
export type ModelContext = { tx: Prisma.TransactionClient; actor: ModelActor; operation: "create" | "update"; id?: string };

export class ModelValidationError extends Error {
  constructor(message: string, readonly fieldErrors?: Record<string, string>) { super(message); }
}
