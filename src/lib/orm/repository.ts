import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ListRecord } from "../list/types";
import type { SavedRecord } from "./record";
import type { RecordAudit } from "./audit";
import type { GroupQuery } from "../list/grouping";
import type { ListGroup } from "../list/types";
import type { RelationAccess } from "./relation-access";

export type RepositoryQuery = { where: Record<string, unknown>; sort: string; direction: "asc" | "desc"; skip: number; take: number; audit?: boolean };
/**
 * `access` (optional) lets the service mask related records the actor cannot read as null.
 * Repositories whose relations carry no record rules may ignore it.
 */
export interface ModelRepository<T> {
  related?(tx: Prisma.TransactionClient, field: string, id: string, access?: RelationAccess): Promise<Record<string, unknown>>;
  relatedMany?(tx: Prisma.TransactionClient, field: string, ids: readonly string[], outputs: readonly string[], access?: RelationAccess): Promise<Readonly<Record<string, Readonly<Record<string, unknown>>>>>;
  read(tx: Prisma.TransactionClient, id: string): Promise<SavedRecord<T> | null>;
  audit?(tx: Prisma.TransactionClient, id: string): Promise<RecordAudit | null>;
  create(tx: Prisma.TransactionClient, values: T, actorId: string): Promise<SavedRecord<T>>;
  update(tx: Prisma.TransactionClient, id: string, revision: string, values: T): Promise<SavedRecord<T>>;
  remove?(tx: Prisma.TransactionClient, id: string, revision: string): Promise<void>;
  count(tx: Prisma.TransactionClient, where: Record<string, unknown>): Promise<number>;
  lookup?(tx: Prisma.TransactionClient, query: { fields: readonly string[]; where: Record<string, unknown>; skip: number; take: number; access?: RelationAccess }): Promise<Record<string, unknown>[]>;
  /** Generated, authorized relation paths. Legacy adapters fail closed until rebound. */
  readonly lookupPaths?: readonly string[];
  list(tx: Prisma.TransactionClient, query: RepositoryQuery): Promise<ListRecord[]>;
  groups?(tx: Prisma.TransactionClient, query: GroupQuery): Promise<ListGroup[]>;
  /**
   * Many2many in collections: a predicate over the link table (own or through an extension's
   * companion row) for `any`/`all` IDs or emptiness. IDs are already validated by the service.
   */
  many2manyWhere?(field: string, operator: "any" | "all" | "empty" | "notEmpty", ids: readonly string[]): Record<string, unknown>;
  /** Linked IDs per record of a page, ordered by ID. */
  many2manyIds?(tx: Prisma.TransactionClient, field: string, ids: readonly string[]): Promise<ReadonlyMap<string, readonly string[]>>;
}

export function unboundRepository<T>(): ModelRepository<T> {
  const unavailable = async (): Promise<never> => { throw new Error("MODEL_NOT_BOUND"); };
  return { read: unavailable, create: unavailable, update: unavailable, remove: unavailable, count: unavailable, list: unavailable };
}
