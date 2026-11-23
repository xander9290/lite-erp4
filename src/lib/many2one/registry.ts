import "server-only";

import { prisma } from "../prisma";
import type { Prisma } from "../../generated/prisma/client";
import { lookupPage, lookupWindow, userLookupWhere, type LookupQuery } from "./query";

// This is the server allowlist, not a dynamic prisma[model] supplied by the browser.
// The action requires an active session; hashes and security fields never leave this registry.
const userSelect = { id: true, login: true, name: true } satisfies Prisma.UserSelect;

export const lookupRegistry = {
  user: async (request: LookupQuery) => {
    const where: Prisma.UserWhereInput = { ...userLookupWhere(request), ...(request.id ? { id: request.id } : request.ids ? { id: { in: request.ids } } : {}) };
    return lookupPage(lookupWindow(request), {
      count: () => prisma.user.count({ where }),
      read: (skip, take) => prisma.user.findMany({ where, select: userSelect, orderBy: [{ login: "asc" }, { id: "asc" }], skip, take }),
    });
  },

};
