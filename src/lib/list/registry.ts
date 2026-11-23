import "server-only";

import { prisma } from "../prisma";
import type { Prisma } from "../../generated/prisma/client";
import { lookupPage, userLookupWhere } from "../many2one/query";
import type { ListConfig, ListPage, ListState } from "./types";
import { compileListFilters } from "./filters";

// Public DTOs only. The action requires an active session, and an administrator for users.
export const listRegistry = {

  user: async (config: ListConfig, state: ListState): Promise<ListPage> => {
    const where = { AND: [userLookupWhere({ query: state.query, searchFields: [...config.searchFields] }), ...compileListFilters(config, state.filters)] } as Prisma.UserWhereInput;
    const order: Prisma.UserOrderByWithRelationInput = state.sort === "name" ? { name: state.direction }
      : state.sort === "email" ? { email: { sort: state.direction, nulls: "last" } }
      : state.sort === "phone" ? { phone: { sort: state.direction, nulls: "last" } }
      : state.sort === "lastLogin" ? { lastLogin: { sort: state.direction, nulls: "last" } }
      : state.sort === "active" ? { active: state.direction } : state.sort === "isAdmin" ? { isAdmin: state.direction }
      : state.sort === "createdAt" ? { createdAt: state.direction }
      : state.sort === "id" ? { id: state.direction } : { login: state.direction };
    const result = await lookupPage(state, {
      count: () => prisma.user.count({ where }),
      read: (skip, take) => prisma.user.findMany({
        where, skip, take, orderBy: [order, ...(state.sort === "id" ? [] : [{ id: "asc" as const }])],
        select: { id: true, updatedAt: true, login: true, lastLogin: true, active: true, isAdmin: true, createdAt: true, name: true, email: true, phone: true, avatarUrl: true },
      }),
    });
    return { rows: result.records.map(({ updatedAt, ...record }) => ({ ...record, revision: updatedAt.toISOString(), lastLogin: record.lastLogin?.toISOString() ?? null, createdAt: record.createdAt.toISOString() })), total: result.total, page: result.page, pageSize: result.pageSize };
  },
};
