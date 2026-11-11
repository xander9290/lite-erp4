import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ListRecord } from "../list/types";
import type { SavedRecord } from "./record";
import type { RecordAudit } from "./audit";
import type { GroupQuery } from "../list/grouping";
import type { ListGroup } from "../list/types";

export type RepositoryQuery = { where: Record<string, unknown>; sort: string; direction: "asc" | "desc"; skip: number; take: number; audit?: boolean };
export interface ModelRepository<T> {
  read(tx: Prisma.TransactionClient, id: string): Promise<SavedRecord<T> | null>;
  audit?(tx: Prisma.TransactionClient, id: string): Promise<RecordAudit | null>;
  create(tx: Prisma.TransactionClient, values: T, actorId: string): Promise<SavedRecord<T>>;
  update(tx: Prisma.TransactionClient, id: string, revision: string, values: T): Promise<SavedRecord<T>>;
  remove?(tx: Prisma.TransactionClient, id: string, revision: string): Promise<void>;
  count(tx: Prisma.TransactionClient, where: Record<string, unknown>): Promise<number>;
  lookup?(tx: Prisma.TransactionClient, query: { fields: readonly string[]; where: Record<string, unknown>; skip: number; take: number }): Promise<Record<string, unknown>[]>;
  /** Generated, authorized relation paths. Legacy adapters fail closed until rebound. */
  readonly lookupPaths?: readonly string[];
  list(tx: Prisma.TransactionClient, query: RepositoryQuery): Promise<ListRecord[]>;
  groups?(tx: Prisma.TransactionClient, query: GroupQuery): Promise<ListGroup[]>;
}

export function unboundRepository<T>(): ModelRepository<T> {
  const unavailable = async (): Promise<never> => { throw new Error("MODEL_NOT_BOUND"); };
  return { read: unavailable, create: unavailable, update: unavailable, remove: unavailable, count: unavailable, list: unavailable };
}
