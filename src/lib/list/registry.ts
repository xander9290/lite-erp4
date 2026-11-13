import "server-only";

import { prisma } from "../prisma";
import type { Prisma } from "../../generated/prisma/client";
import { lookupPage, partnerLookupWhere, userLookupWhere } from "../many2one/query";
import type { ListConfig, ListPage, ListState } from "./types";
import { compileListFilters } from "./filters";

// Public DTOs only. The action requires an active session, and an administrator for users.
export const listRegistry = {
  partner: async (config: ListConfig, state: ListState): Promise<ListPage> => {
    // Dynamic predicates are constrained by the server's field/type registry before compilation.
    const where = { AND: [partnerLookupWhere({ query: state.query, searchFields: [...config.searchFields] }), ...compileListFilters(config, state.filters)] } as Prisma.PartnerWhereInput;
    const order: Prisma.PartnerOrderByWithRelationInput = state.sort === "user.login" ? { user: { login: state.direction } }
      : state.sort === "email" ? { email: { sort: state.direction, nulls: "last" } }
      : state.sort === "phone" ? { phone: { sort: state.direction, nulls: "last" } }
      : state.sort === "id" ? { id: state.direction } : { name: state.direction };
    const result = await lookupPage(state, {
      count: () => prisma.partner.count({ where }),
      read: (skip, take) => prisma.partner.findMany({
        where, skip, take, orderBy: [order, ...(state.sort === "id" ? [] : [{ id: "asc" as const }])],
        select: { id: true, updatedAt: true, name: true, email: true, phone: true, avatarUrl: true, user: { select: { id: true, login: true } } },
      }),
    });
    return { rows: result.records.map(({ updatedAt, ...record }) => ({ ...record, revision: updatedAt.toISOString() })), total: result.total, page: result.page, pageSize: result.pageSize };
  },
  user: async (config: ListConfig, state: ListState): Promise<ListPage> => {
    const where = { AND: [userLookupWhere({ query: state.query, searchFields: [...config.searchFields] }), ...compileListFilters(config, state.filters)] } as Prisma.UserWhereInput;
    const order: Prisma.UserOrderByWithRelationInput = state.sort === "partner.name" ? { partner: { name: state.direction } }
      : state.sort === "lastLogin" ? { lastLogin: { sort: state.direction, nulls: "last" } }
      : state.sort === "active" ? { active: state.direction } : state.sort === "isAdmin" ? { isAdmin: state.direction }
      : state.sort === "createdAt" ? { createdAt: state.direction }
      : state.sort === "id" ? { id: state.direction } : { login: state.direction };
    const result = await lookupPage(state, {
      count: () => prisma.user.count({ where }),
      read: (skip, take) => prisma.user.findMany({
        where, skip, take, orderBy: [order, ...(state.sort === "id" ? [] : [{ id: "asc" as const }])],
        select: { id: true, updatedAt: true, login: true, lastLogin: true, active: true, isAdmin: true, createdAt: true, partner: { select: { id: true, name: true, avatarUrl: true } } },
      }),
    });
    return { rows: result.records.map(({ updatedAt, ...record }) => ({ ...record, revision: updatedAt.toISOString(), lastLogin: record.lastLogin?.toISOString() ?? null, createdAt: record.createdAt.toISOString() })), total: result.total, page: result.page, pageSize: result.pageSize };
  },
};
